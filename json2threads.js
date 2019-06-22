"use strict";
/*
First run
$ mastodon-archive archive --no-favourites --with-mentions USERNAME@INSTANCE
*/
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
    ret += status.media_attachments.map(o => `- ![${o.description}](${o.url})\n`);
  }
  return ret;
}
if (module === require.main) {
  var all = JSON.parse(readFileSync('octodon.social.user.22.json', 'utf8'));
  var parent2childid = new Map();
  var child2parentid = new Map();
  var threadStarts = new Set();
  var replying = new Set();
  var id2status = new Map();
  for (const s of all.statuses) {
    const child = s.id;
    id2status.set(child, s);

    if (s.reblog) { continue; }

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
  // console.log('replying.size', replying.size)
  // loop over threadStarts for my own thread starts/boosts?, but also replying to get replies
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
  var threadFilenames = Array.from(threadFiles.keys());
  threadFilenames.sort();
  // console.log(threadFiles);
  mkdirpSync('threads');
  threadFilenames.forEach(k => writeFileSync(`threads/${k}.md`, threadFiles.get(k)))
}