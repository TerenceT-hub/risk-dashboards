// Watches Data File.xlsx for changes. On change: regenerates the JSON data files,
// then commits and pushes them to GitHub automatically.
//
// Start it with:  npm run watch
// Leave the window open (or run it at login -- see README-sync.md) for it to keep working.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const chokidar = require('chokidar');
const { refresh } = require('./refresh-data');

const SOURCE_WORKBOOK = "C:\\Users\\khnq757\\OneDrive - AZCollaboration\\GFS Digital Delivery - 01. Requirements\\Data File.xlsx";
const REPO_DIR = __dirname;

function findGitExe() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'GitHubDesktop');
  if (!fs.existsSync(base)) throw new Error('GitHub Desktop install not found -- update GIT_EXE manually.');
  const appDir = fs.readdirSync(base).find((d) => d.startsWith('app-'));
  if (!appDir) throw new Error('Could not find a GitHub Desktop app-* folder under ' + base);
  const gitPath = path.join(base, appDir, 'resources', 'app', 'git', 'cmd', 'git.exe');
  if (!fs.existsSync(gitPath)) throw new Error('git.exe not found at ' + gitPath);
  return gitPath;
}

const GIT_EXE = findGitExe();

function git(args) {
  return execFileSync(GIT_EXE, args, { cwd: REPO_DIR, encoding: 'utf8' });
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function syncOnce() {
  try {
    log('Change detected -- refreshing data...');
    refresh();

    git(['add', 'data', 'data.json']);

    const status = git(['status', '--porcelain', '--', 'data', 'data.json']);
    if (!status.trim()) {
      log('No data changes after refresh -- nothing to commit.');
      return;
    }

    git(['commit', '-m', `Auto-refresh data (${new Date().toISOString()})`]);
    log('Committed. Pushing...');
    git(['push', 'origin', 'main']);
    log('Pushed. GitHub Pages will redeploy in ~1 minute.');
  } catch (err) {
    log('ERROR during sync: ' + (err.stderr || err.message));
  }
}

log(`Watching: ${SOURCE_WORKBOOK}`);
log(`Repo: ${REPO_DIR}`);
log(`git: ${GIT_EXE}`);

const watcher = chokidar.watch(SOURCE_WORKBOOK, {
  awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 500 }
});

watcher.on('change', syncOnce);
watcher.on('error', (err) => log('Watcher error: ' + err.message));

log('Watcher started. Leave this window open. Ctrl+C to stop.');
