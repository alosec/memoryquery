#!/usr/bin/env node

// Test script to debug chokidar watcher issue
const chokidar = require('chokidar');
const path = require('path');
const os = require('os');

const projectsPath = path.join(os.homedir(), '.claude/projects');

console.log('Starting watcher test...');
console.log('Watching:', projectsPath);

// Simple watcher configuration
const watcher = chokidar.watch(projectsPath, {
  persistent: true,
  ignoreInitial: true,
  usePolling: true,
  interval: 500,
  depth: 2
});

watcher
  .on('ready', () => {
    console.log('Watcher ready!');
    console.log('Watched paths:', Object.keys(watcher.getWatched()));
  })
  .on('all', (event, path) => {
    console.log(`Event: ${event}, Path: ${path}`);
  })
  .on('add', path => console.log(`File added: ${path}`))
  .on('change', path => console.log(`File changed: ${path}`))
  .on('unlink', path => console.log(`File removed: ${path}`))
  .on('error', error => console.error(`Watcher error: ${error}`));

console.log('Watcher started. Create/modify files in', projectsPath);
console.log('Press Ctrl+C to stop');

// Keep process alive
setInterval(() => {}, 1000);
