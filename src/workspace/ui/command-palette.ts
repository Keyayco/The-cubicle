import type { EventBus, Registry } from '../../core';
import type { WorkspaceCommand } from '../types';

const COMMAND_PALETTE_EVENT = 'command-palette:executed';

/**
 * Keyboard-accessible command palette backed by registry commands.
 */
export class CommandPalette {
  private readonly element: HTMLDivElement;

  private readonly input: HTMLInputElement;

  private readonly results: HTMLUListElement;

  private isOpen = false;

  constructor(
    private readonly registry: Registry,
    private readonly eventBus: EventBus,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'cube-command-palette';
    this.element.hidden = true;

    const panel = document.createElement('div');
    panel.className = 'cube-command-palette__panel';

    this.input = document.createElement('input');
    this.input.className = 'cube-command-palette__input';
    this.input.placeholder = 'Type a command';

    this.results = document.createElement('ul');
    this.results.className = 'cube-command-palette__results';

    panel.append(this.input, this.results);
    this.element.append(panel);

    this.input.addEventListener('input', () => {
      this.renderResults();
    });

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const firstResult = this.getFilteredCommands()[0];

        if (firstResult) {
          void this.execute(firstResult);
        }
      }
    });

    window.addEventListener('keydown', this.handleGlobalKeydown);
  }

  /**
   * Returns the palette host element.
   */
  public getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Opens the command palette.
   */
  public open(): void {
    this.isOpen = true;
    this.element.hidden = false;
    this.input.value = '';
    this.renderResults();
    this.input.focus();
  }

  /**
   * Closes the command palette.
   */
  public close(): void {
    this.isOpen = false;
    this.element.hidden = true;
  }

  /**
   * Toggles the command palette.
   */
  public toggle(): void {
    if (this.isOpen) {
      this.close();
      return;
    }

    this.open();
  }

  /**
   * Removes event listeners owned by the palette.
   */
  public destroy(): void {
    window.removeEventListener('keydown', this.handleGlobalKeydown);
  }

  private readonly handleGlobalKeydown = (event: KeyboardEvent): void => {
    const isOpenShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

    if (isOpenShortcut) {
      event.preventDefault();
      this.toggle();
      return;
    }

    if (event.key === 'Escape' && this.isOpen) {
      event.preventDefault();
      this.close();
    }
  };

  private getCommands(): WorkspaceCommand[] {
    return this.registry
      .entries<WorkspaceCommand>('commands')
      .map(([, command]) => command);
  }

  private getFilteredCommands(): WorkspaceCommand[] {
    const query = this.input.value.trim().toLowerCase();

    if (query.length === 0) {
      return this.getCommands();
    }

    return this.getCommands().filter((command) => {
      const haystack = [command.title, ...command.keywords].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }

  private renderResults(): void {
    this.results.innerHTML = '';

    for (const command of this.getFilteredCommands()) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cube-command-palette__result';
      button.textContent = command.title;
      button.addEventListener('click', () => {
        void this.execute(command);
      });
      item.append(button);
      this.results.append(item);
    }
  }

  private async execute(command: WorkspaceCommand): Promise<void> {
    await command.execute();
    this.eventBus.emit(COMMAND_PALETTE_EVENT, {
      commandId: command.id,
    });
    this.close();
  }
}
