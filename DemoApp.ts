import {
    IAppAccessors,
    IConfigurationExtend,
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
import { IUIKitInteractionHandler } from '@rocket.chat/apps-engine/definition/uikit/IUIKitActionHandler';
import { IUIKitResponse, UIKitActionButtonInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { UIActionButtonContext } from '@rocket.chat/apps-engine/definition/ui/UIActionButtonContext';
import { ISettingSelectValue, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export class DemoApp extends App implements IUIKitInteractionHandler {
    private readonly appLogger: ILogger
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
        this.appLogger = logger;
    }

    public async extendConfiguration(
        configuration: IConfigurationExtend
    ): Promise<void> {

        configuration.ui.registerButton({
            actionId: 'demoapp-action-id', // this identifies your button in the interaction event
            labelI18n: 'demoapp-action-name', // key of the i18n string containing the name of the button
            context: UIActionButtonContext.ROOM_ACTION // in what context the action button will be displayed in the UI
        });
        await configuration.settings.provideSetting({
            id: 'demoapp_department',
            type: SettingType.SELECT,
            packageValue: '',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'demoapp_department',
            i18nDescription: 'demoapp_department_desc',
            values: await getISettingSelectValues(this.getAccessors().reader.getLivechatReader())
        });
        await configuration.settings.provideSetting({
            id: 'demoapp_admin_username',
            type: SettingType.STRING,
            packageValue: 'demo',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'demoapp_admin_username',
            i18nDescription: 'demoapp_admin_username_desc'
        });
        await configuration.settings.provideSetting({
            id: 'demoapp_admin_user_pass',
            type: SettingType.PASSWORD,
            packageValue: 'demo',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'demoapp_admin_user_pass',
            i18nDescription: 'demoapp_admin_user_pass_desc'
        });
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
        const username = await read.getEnvironmentReader().getSettings().getValueById('demoapp_admin_username');
        const password = await read.getEnvironmentReader().getSettings().getValueById('demoapp_admin_user_pass');
        const url = await super.getAccessors().environmentReader.getEnvironmentVariables().getValueByName('ROOT_URL');
        const department = await read.getEnvironmentReader().getSettings().getValueById('demoapp_department');
        // If you have multiple action buttons, use `actionId` to determine
        // which one the user interacted with
        if (actionId === 'demoapp-action-id') {
            const blockBuilder = modify.getCreator().getBlockBuilder();
            const agentStrings: string[]=await this.getAgentsState(department, url, username, password, http);
            for(let i=0;i<agentStrings.length;i++) {
                blockBuilder.addSectionBlock({
                    text: blockBuilder.newPlainTextObject('- '+agentStrings[i])
                });
            }

            return context.getInteractionResponder().openModalViewResponse({
                blocks: blockBuilder.getBlocks(),
                title: blockBuilder.newPlainTextObject('Agents of selected department:')
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
        let header = await this.buildHeader(url, username, password, http);
        let agents: string[] = await this.getAgents(department, url,header, http);
        let agentString: string[] = [];

        for (let i = 0; i < agents.length; i++) {
            let agent = agents[i];
            let response = await this.processGet(url + '/api/v1/users.info?username=' + agent, http, header);
            let responseObj = JSON.parse('' + response.content);
            agentString.push( agent + ' (' + responseObj.user.status + ') ');
        }
        return agentString;
    }

    async processGet(url: string, http: IHttp, apiHeaders: any): Promise<IHttpResponse> {
        return await http.get(url, {
            headers: apiHeaders
        });
    }

    private async getAgents(department: string, url: string, header: string, http: IHttp) {
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
