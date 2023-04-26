import {
    IAppAccessors,
    IConfigurationExtend,
    IConfigurationModify,
    IHttp,
    IHttpResponse,
    ILivechatRead,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { HelloWorldCommand } from './commands/HelloWorldCommand';
import { ApiVisibility, ApiSecurity } from '@rocket.chat/apps-engine/definition/api';
import { Endpoint } from './endpoints/Endpoint';
import { IPreMessageSentPrevent } from '@rocket.chat/apps-engine/definition/messages/IPreMessageSentPrevent';
import { IMessage, IPostMessageSent } from '@rocket.chat/apps-engine/definition/messages';
import { OpenCtxBarCommand, createContextualBarBlocks } from './commands/OpenCtxBarCommand';
import { IUIKitInteractionHandler } from '@rocket.chat/apps-engine/definition/uikit/IUIKitActionHandler';
import { UIKitBlockInteractionContext, UIKitViewSubmitInteractionContext, IUIKitResponse, ISectionBlock, UIKitActionButtonInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { UIActionButtonContext } from '@rocket.chat/apps-engine/definition/ui/UIActionButtonContext';
import { ISettingSelectValue, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export class MyFirstAppApp extends App implements IPreMessageSentPrevent, IPostMessageSent, IUIKitInteractionHandler {
    private readonly appLogger: ILogger
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.appLogger = logger;
        this.appLogger.debug('Hello, World!');
    }

    async checkPostMessageSent?(message: IMessage, read: IRead, http: IHttp): Promise<boolean> {
        if (message.room.slugifiedName === 'general') {
            return false;
        }
        return true;
    }

    async executePostMessageSent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<void> {
        const general = await read.getRoomReader().getByName('general');
        const messageBuilder = modify.getCreator().startMessage({
            text: `@${message.sender.username} said "${message.text}" in #${message.room.displayName}`,
        } as IMessage);

        if (!general) {
            return;
        }
        messageBuilder.setRoom(general);
        await modify.getCreator().finish(messageBuilder);
    }

    async executePreMessageSentPrevent(message: IMessage, read: IRead, http: IHttp, persistence: IPersistence): Promise<boolean> {
        if (message.room.slugifiedName === 'general') {
            return false;
        }
        if (message.text && message.text.indexOf('test') != -1)
            return true;
        return false;
    }

    public async extendConfiguration(
        configuration: IConfigurationExtend
    ): Promise<void> {
        const helloWorldCommand: HelloWorldCommand = new HelloWorldCommand()
        const contextualBarCommand: OpenCtxBarCommand = new OpenCtxBarCommand(this);
        await configuration.slashCommands.provideSlashCommand(helloWorldCommand);
        await configuration.slashCommands.provideSlashCommand(contextualBarCommand);

        configuration.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [new Endpoint(this)],
        });
        configuration.ui.registerButton({
            actionId: 'my-action-id', // this identifies your button in the interaction event
            labelI18n: 'my-action-name', // key of the i18n string containing the name of the button
            context: UIActionButtonContext.MESSAGE_ACTION, // in what context the action button will be displayed in the UI
        });
        await configuration.settings.provideSetting({
            id: 'myfirstapp_department',
            type: SettingType.SELECT,
            packageValue: '',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'myfirstapp_department',
            i18nDescription: 'myfirstapp_department_desc',
            values: await getISettingSelectValues(this.getAccessors().reader.getLivechatReader())
        });
        await configuration.settings.provideSetting({
            id: 'myfirstapp_admin_username',
            type: SettingType.STRING,
            packageValue: 'demo',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'myfirstapp_admin_username',
            i18nDescription: 'myfirstapp_admin_username_desc'
        });
        await configuration.settings.provideSetting({
            id: 'myfirstapp_admin_user_pass',
            type: SettingType.PASSWORD,
            packageValue: 'demo',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'myfirstapp_admin_user_pass',
            i18nDescription: 'myfirstapp_admin_user_pass_desc'
        });
    }


    public async executeBlockActionHandler(context: UIKitBlockInteractionContext, _read: IRead, _http: IHttp, _persistence: IPersistence, modify: IModify) {
        const data = context.getInteractionData();

        const contextualbarBlocks = createContextualBarBlocks(modify, data.container.id);

        // [9]
        await modify.getUiController().updateContextualBarView(contextualbarBlocks, { triggerId: data.triggerId }, data.user);

        return {
            success: true,
        };
    }


    public async executeViewSubmitHandler(context: UIKitViewSubmitInteractionContext): Promise<IUIKitResponse> {
        const data = context.getInteractionData()

        // [11]
        const text = (data.view.blocks[0] as ISectionBlock).text.text;


        return {
            success: true,
        };
    }

    public async executeActionButtonHandler(
        context: UIKitActionButtonInteractionContext,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify
    ): Promise<IUIKitResponse> {
        const {
            buttonContext,
            actionId,
            triggerId,
            user,
            room,
            message
        } = context.getInteractionData();
        const username = await read.getEnvironmentReader().getSettings().getValueById('myfirstapp_admin_username');
        const password = await read.getEnvironmentReader().getSettings().getValueById('myfirstapp_admin_user_pass');
        const url = await super.getAccessors().environmentReader.getEnvironmentVariables().getValueByName('ROOT_URL');
        const department = await read.getEnvironmentReader().getSettings().getValueById('myfirstapp_department');
        // If you have multiple action buttons, use `actionId` to determine
        // which one the user interacted with
        if (actionId === 'my-action-id') {
            const blockBuilder = modify.getCreator().getBlockBuilder();

            return context.getInteractionResponder().openModalViewResponse({
                title: blockBuilder.newPlainTextObject('Interaction received'),
                blocks: blockBuilder.addSectionBlock({
                    text: blockBuilder.newPlainTextObject(await this.getAgentsState(department, url, username, password, http))
                }).getBlocks()
            });
        }

        return context.getInteractionResponder().successResponse();
    }





    async processPost(apiHeaders: any, url: string, payload: any, http: IHttp): Promise<IHttpResponse> {

        return await http.post(url, {
            headers: apiHeaders,
            content: JSON.stringify(payload)
        });
    }

    private async buildHeader(url: string, username: string, password: string, http: IHttp): Promise<any> {
        let header = { 'Content-Type': 'application/json' };
        let payload = {
            "user": username,
            "password": password
        };
        let response = this.processPost(header, url + '/api/v1/login', payload, http);
        let responseObj = JSON.parse('' + (await response).content);
        return {
            'Content-Type': 'application/json',
            'X-Auth-Token': responseObj.data.authToken,
            'X-User-Id': responseObj.data.userId
        }
    }

    private async getAgentsState(department: string, url: string, username: string, password: string, http: IHttp) {
        let agents: string[] = await this.getAgents(department, url, username, password, http);
        let agentString = 'Agents of selected department:';
        let header = await this.buildHeader(url, username, password, http);
        for (let i = 0; i < agents.length; i++) {
            let agent = agents[i];
            let response = await this.processGet(url + '/api/v1/users.info?username=' + agent, http, header);
            let responseObj = JSON.parse('' + response.content);
            agentString += ' ' + agent + ' (' + responseObj.user.status + ') ';
        }
        return agentString;
    }

    async processGet(url: string, http: IHttp, apiHeaders: any): Promise<IHttpResponse> {
        return await http.get(url, {
            headers: apiHeaders
        });
    }

    private async getAgents(department: string, url: string, username: string, password: string, http: IHttp) {
        let header = await this.buildHeader(url, username, password, http);
        let response = await this.processGet(url + '/api/v1/livechat/department/' + department + '/agents', http, header);
        let responseObj = JSON.parse('' + response.content);
        let agents: string[] = [];
        for (let i = 0; i < responseObj.agents.length; i++) {
            let agent = responseObj.agents[i];
            agents.push(agent.username);
        }
        return agents;
    }


}




export async function getISettingSelectValues(livechat: ILivechatRead): Promise<ISettingSelectValue[]> {
    let values: ISettingSelectValue[] = [];
    let depts = await livechat.getDepartmentsEnabledWithAgents();

    for (let i = 0; i < depts.length; i++) {
        let key_value: string = depts[i].id
        let name_value: string = depts[i].name + ''
        let value: ISettingSelectValue = {
            key: key_value,
            i18nLabel: name_value
        }
        values.push(value);
    }

    return values;
}
