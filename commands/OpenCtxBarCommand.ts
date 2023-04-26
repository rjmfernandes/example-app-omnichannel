import {
    IModify,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { ISlashCommand, SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';
import { BlockElementType } from '@rocket.chat/apps-engine/definition/uikit';
import { IUIKitContextualBarViewParam } from '@rocket.chat/apps-engine/definition/uikit/UIKitInteractionResponder';

// This is the slashcommand that opens the contextual bar:
// - first we get the triggerId  to open the surface (without this is would not be possible to open the contextual bar) ([1])
// - then we create the blocks we will render inside the contextual bar ([2])
// - then call the method that opens the contextual bar ([3]).
export class OpenCtxBarCommand implements ISlashCommand {
    // this is what we will type when calling the slashcommand: /contextualbar
    public command = 'contextualbar';
    public i18nParamsExample = 'slashcommand_params';
    public i18nDescription = 'slashcommand_description';
    public providesPreview = false;

    constructor(private readonly app: App) {}

    public async executor(context: SlashCommandContext, _read: IRead, modify: IModify): Promise<void> {
        const triggerId = context.getTriggerId() as string; // [1]
        const user = context.getSender();

        const contextualbarBlocks = createContextualBarBlocks(modify); // [2]

        await modify.getUiController().openContextualBarView(contextualbarBlocks, { triggerId }, user); // [3]
    }


}

export function createContextualBarBlocks(modify: IModify, viewId?: string): IUIKitContextualBarViewParam {
    const blocks = modify.getCreator().getBlockBuilder();

    const date = new Date().toISOString();

    blocks.addSectionBlock({
        text: blocks.newMarkdownTextObject(`The current date-time is\n${date}`), // [4]
        accessory: { // [5]
            type: BlockElementType.BUTTON,
            actionId: 'date',
            text: blocks.newPlainTextObject('Refresh'),
            value: date,
        },
    });

    return { // [6]
        id: viewId || 'contextualbarId',
        title: blocks.newPlainTextObject('Contextual Bar'),
        submit: blocks.newButtonElement({
            text: blocks.newPlainTextObject('Submit'),
        }),
        blocks: blocks.getBlocks(),
    };
}
