import type {
  CommandDefinition,
  PluginDefinition,
} from '../core';

export const DEMO_PLUGIN_ID = 'demo.greeter';
export const DEMO_GREETING_COMMAND_ID = 'demo.greeter.sayHello';

export interface DemoGreetingArgs {
  name?: string;
}

/**
 * Optional sample plugin demonstrating PluginLoader and CommandService.
 * The host must register and load this definition explicitly.
 */
export const demoPlugin: PluginDefinition = {
  id: DEMO_PLUGIN_ID,
  activate: ({ commands }) => {
    const greetingCommand: CommandDefinition<DemoGreetingArgs, string> = {
      id: DEMO_GREETING_COMMAND_ID,
      title: 'Say Hello',
      keywords: ['demo', 'greeting', 'hello'],
      execute: (args = {}) => `Hello, ${args.name?.trim() || 'world'}!`,
    };

    commands.register(greetingCommand);

    return () => {
      commands.unregister(DEMO_GREETING_COMMAND_ID);
    };
  },
};
