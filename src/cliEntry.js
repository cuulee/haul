/**
 * Copyright 2017-present, Callstack.
 * All rights reserved.
 *
 * @flow
 */
import type { Command } from './types';

const minimist = require('minimist');
const camelcaseKeys = require('camelcase-keys');
const clear = require('clear');

const pjson = require('../package.json');
const logger = require('./logger');
const messages = require('./messages');
const { MessageError } = require('./errors');

const DEFAULT_COMMAND = require('./commands/start');

const COMMANDS: Array<Command> = [
  require('./commands/init'),
  require('./commands/start'),
  require('./commands/bundle'),
];

const NOT_SUPPORTED_COMMANDS = [
  'run-ios',
  'run-android',
  'library',
  'unbundle',
  'link',
  'unlink',
  'install',
  'uninstall',
  'upgrade',
  'log-android',
  'log-ios',
  'dependencies',
];

function validateOptions(options, flags, command) {
  return options.reduce(
    (acc, option) => {
      const defaultValue = typeof option.default === 'function'
        ? option.default(acc)
        : option.default;

      let value = flags[option.name] || defaultValue;

      if (option.required && !value) {
        throw new MessageError(
          messages.invalidOption({
            option,
            command,
          }),
        );
      }

      if (!value) {
        return acc;
      }

      if (option.choices && !option.choices.find(c => c.value === value)) {
        throw new MessageError(
          messages.invalidOption({
            option,
            value,
            command,
          }),
        );
      }

      if (option.parse) {
        value = option.parse(value);
      }

      return Object.assign({}, acc, {
        [option.name]: value,
      });
    },
    {},
  );
}

async function run(args: Array<string>) {
  if (
    args[0] === 'version' || args.includes('-v') || args.includes('--version')
  ) {
    console.log(`v${pjson.version}`);
    return;
  }

  if (['--help', '-h', 'help'].includes(args[0])) {
    console.log(messages.haulHelp(COMMANDS));
    return;
  }

  if (NOT_SUPPORTED_COMMANDS.includes(args[0])) {
    logger.info(messages.commandNotImplemented(args[0]));
    return;
  }

  const command = COMMANDS.find(cmd => cmd.name === args[0]) || DEFAULT_COMMAND;

  if (args.includes('--help') || args.includes('-h')) {
    console.log(messages.haulCommandHelp(command));
    return;
  }

  const opts = command.options || [];

  const flags = camelcaseKeys(
    minimist(args, {
      string: opts.map(opt => opt.name),
    }),
  );

  const displayName = `haul ${command.name}`;

  try {
    await command.action(validateOptions(opts, flags, displayName));
  } catch (error) {
    clear();
    if (error instanceof MessageError) {
      logger.error(error.message);
    } else {
      logger.error(
        messages.commandFailed({
          command: displayName,
          error,
          stack: error.stack,
        }),
      );
    }
    process.exit(1);
  }
}

module.exports = run;
