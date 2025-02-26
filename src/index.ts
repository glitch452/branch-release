import * as core from '@actions/core';
import { exec } from '@actions/exec';
import * as github from '@actions/github';
import { run } from './core/run.js';
import { GitService } from './services/GitService.js';

const logger = core;
const workflow = core;
const git = new GitService(logger);

void run(logger, workflow, github, git, exec);
