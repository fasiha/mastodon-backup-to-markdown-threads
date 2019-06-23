## Setup
1. Install [Git](https://git-scm.com)
1. Install [Node](https://nodejs.org)
1. Install [Mastodon Archive](https://github.com/kensanata/mastodon-backup) 
## Usage
In your command line terminal (Terminal app, Command Prompt, xterm, etc.), run the following:
```
$ git clone https://github.com/fasiha/mastodon-backup-to-markdown-threads.git
$ cd mastodon-backup-to-markdown-threads
$ npm i
$ mastodon-archive archive USERNAME@INSTANCE
```
On that last line, make sure you replace "USERNAME" and "INSTANCE" with your instance and username. e.,g, "22@octodon.social". This will create a file `INSTANCE.user.USERNAME.json` (or in my case, `octodon.social.user.22.json`).

Finally, run
```
$ node json2threads.js INSTANCE.user.USERNAME.json
```
and look at the `threads/` directory.
