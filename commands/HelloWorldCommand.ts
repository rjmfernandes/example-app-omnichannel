import { IRead, IModify, IHttp, IPersistence, IMessageBuilder, IModifyCreator } from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { ISlashCommand, ISlashCommandPreview, ISlashCommandPreviewItem, SlashCommandContext } from "@rocket.chat/apps-engine/definition/slashcommands";
import { IUser } from "@rocket.chat/apps-engine/definition/users";


export class HelloWorldCommand implements ISlashCommand {
    public command = 'hello'
    public i18nDescription = 'myfirstapp_hellocommand_description'
    public providesPreview = false
    public i18nParamsExample = ''

    async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const creator: IModifyCreator = modify.getCreator()
        //const sender: IUser = (await read.getUserReader().getAppUser()) as IUser
        const room: IRoom = context.getRoom()
        const sender: IUser = (await context.getSender())
        const args: string[] = context.getArguments();

        if (!args) { // [3]
            return this.notifyMessage(context, modify, 'Needs argument');
        }

        switch (args[0]) { // [4]
            case 'text': // [5]
                this.sendMessage(context, modify, 'Texting!');
                break;

            case 'call': // [6]
                this.sendMessage(context, modify, 'Calling!');
                break;

            case 'url':
                if(args.length<2){
                    return this.notifyMessage(context,modify,'It needs a url value to call')
                }
                let url=args[1]
                const response = await http.get(url);
                const message = '```\n'+JSON.stringify(response.data, null, 2)+'\n```';
                return this.sendMessage(context,modify,message)

            default: // [7]
                return this.notifyMessage(context, modify, 'Unknown subcommand');
        }
    }

    private async sendMessage(context: SlashCommandContext, modify: IModify, message: string): Promise<void> {
        const messageStructure = modify.getCreator().startMessage();
        const sender = context.getSender();
        const room = context.getRoom();

        messageStructure
            .setSender(sender)
            .setRoom(room)
            .setText(message);

        await modify.getCreator().finish(messageStructure);
    }

    private async notifyMessage(context: SlashCommandContext, modify: IModify, message: string): Promise<void> {
        const notifier = modify.getNotifier();
        const messageBuilder = notifier.getMessageBuilder();
        const room = context.getRoom();
        messageBuilder.setText(message);
        messageBuilder.setRoom(room);
        await notifier.notifyUser(context.getSender(), messageBuilder.getMessage());
    }


    previewer?(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<ISlashCommandPreview> {
        throw new Error("Method not implemented.");
    }
    executePreviewItem?(item: ISlashCommandPreviewItem, context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        throw new Error("Method not implemented.");
    }
}
