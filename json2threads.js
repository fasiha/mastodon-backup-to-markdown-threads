"use strict";
var USAGE = `
Install Mastodon Archive https://github.com/kensanata/mastodon-backup and then run

$ mastodon-archive archive USERNAME@INSTANCE

This will create a INSTANCE.user.USERNAME.json file. Now, install Node modules:

$ npm i

Now you can run this script:

$ node json2threads.js INSTANCE.user.USERNAME.json
`;
var {readFileSync, writeFileSync} = require('fs');
var {decode} = require('he');
var mkdirpSync = require('mkdirp').sync;

/**
 *
 * @param {number} start
 * @param {Map<number,number[]>} parent2childid
 * @param {Set<number>} ret
 */
function allDescendants(start, parent2childid, ret = new Set()) {
  ret.add(start);
  const children = parent2childid.get(start);
  if (children) {
    for (const child of children) { allDescendants(child, parent2childid, ret); }
  }
  return ret;
}

function stripHtml(s) { return decode(s.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n').replace(/<[^>]+>/g, '')); }

function status2md(status) {
  let ret = `## ${status.created_at}\n${stripHtml(status.content)}`;
  if (status.media_attachments.length) {
    ret += `### Attachments\n`;
    ret += status.media_attachments.map(o => `- ![${o.description}](${o.url})\n`).join('') + '\n';
  }
  return ret;
}

if (module === require.main) {
  if (process.argv.length < 3) {
    console.error(USAGE);
    process.exit(1);
  }
  var filename = process.argv[2];
  var all = JSON.parse(readFileSync(filename, 'utf8'));

  // Maps to hold the directed graph of toots: indexed by ID (number) only
  var parent2childid = new Map();
  var child2parentid = new Map();

  // Set to hold the toots starting threads (even of length 1), also indexed by ID (number)
  var threadStarts = new Set();

  // Set to hold replies (context won't be available though <sad>), again ID (number)
  var replying = new Set();

  // Map between ID (number) and its corresponding status object
  var id2status = new Map();

  for (const s of all.statuses) {
    const child = s.id;
    id2status.set(child, s);

    if (s.reblog) { continue; } // I don't care about boosts

    const replyingToSomeoneElse = s.in_reply_to_account_id && (s.in_reply_to_account_id !== all.account.id);
    if (replyingToSomeoneElse) {
      replying.add(child);
      continue;
    }

    const parent = s.in_reply_to_id;
    if (parent) {
      // a child can only have one parent, but a parent might have multiple children
      child2parentid.set(child, parent);
      parent2childid.set(parent, (parent2childid.get(parent) || []).concat(child));
    }
    if (!parent) { threadStarts.add(child); }
  }

  // Keys=filenames, values=contents of files
  var threadFiles = new Map();
  for (let parent of threadStarts) {
    let children = allDescendants(parent, parent2childid);
    const statuses = Array.from(children, c => id2status.get(c));
    statuses.sort((a, b) => a.created_at - b.created_at);
    threadFiles.set('thread-' + id2status.get(parent).created_at, '# § \n' + statuses.map(status2md).join(''));
  }
  for (const replyid of replying) {
    const reply = id2status.get(replyid);
    threadFiles.set('reply-' + reply.created_at, status2md(reply));
  }

  // Finally output markdown files to directory
  var threadFilenames = Array.from(threadFiles.keys());
  threadFilenames.sort();
  mkdirpSync('threads');
  threadFilenames.forEach(k => writeFileSync(`threads/${k}.md`, threadFiles.get(k)))
}