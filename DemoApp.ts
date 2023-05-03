import {
    IAppAccessors,
    IConfigurationExtend,
    IHttp,
    IHttpResponse,
    ILivechatRead,
    ILogger,
    IMessageBuilder,
    IModify,
    IModifyCreator,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IMessage } from '@rocket.chat/apps-engine/definition/messages/IMessage';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { ISettingSelectValue, SettingType } from '@rocket.chat/apps-engine/definition/settings';
import { UIActionButtonContext } from '@rocket.chat/apps-engine/definition/ui/UIActionButtonContext';
import { UIKitActionButtonInteractionContext, IUIKitResponse, UIKitViewCloseInteractionContext, ButtonStyle, UIKitBlockInteractionContext } from '@rocket.chat/apps-engine/definition/uikit';
import { IUIKitInteractionHandler } from '@rocket.chat/apps-engine/definition/uikit/IUIKitActionHandler';
import { IUser } from '@rocket.chat/apps-engine/definition/users';


export class DemoApp extends App implements IUIKitInteractionHandler {

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(
        configuration: IConfigurationExtend
    ): Promise<void> {
        configuration.ui.registerButton({
            actionId: 'demo-action-id', // this identifies your button in the interaction event
            labelI18n: 'demo-action-name', // key of the i18n string containing the name of the button
            context: UIActionButtonContext.ROOM_ACTION, // in what context the action button will be displayed in the UI
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
            values: await getISettingSelectValues(super.getAccessors().reader.getLivechatReader())
        });

        await configuration.settings.provideSetting({
            id: 'demoapp_admin_userid',
            type: SettingType.STRING,
            packageValue: 'dEH9Zg5WYsvhFTpAy',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'demoapp_admin_userid',
            i18nDescription: 'demoapp_admin_userid_desc'
        });
        await configuration.settings.provideSetting({
            id: 'demoapp_admin_user_pat',
            type: SettingType.PASSWORD,
            packageValue: 'wXLlI3xb5RliGTLEbKpGV1uIBtjcsUjd_UgucFltsmI',
            required: true,
            public: true,
            hidden: false,
            multiline: false,
            i18nLabel: 'demoapp_admin_user_pat',
            i18nDescription: 'demoapp_admin_user_pat_desc'
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
        const url = await super.getAccessors().environmentReader.getEnvironmentVariables().getValueByName('ROOT_URL');
        const userid = await read.getEnvironmentReader().getSettings().getValueById('demoapp_admin_userid');
        const pat = await read.getEnvironmentReader().getSettings().getValueById('demoapp_admin_user_pat');
        const department = await read.getEnvironmentReader().getSettings().getValueById('demoapp_department');
        const livechatReader = super.getAccessors().reader.getLivechatReader();
        const deptName = (await livechatReader.getLivechatDepartmentByIdOrName(department))?.name;
        // If you have multiple action buttons, use `actionId` to determine
        // which one the user interacted with
        if (actionId === 'demo-action-id') {
            const blockBuilder = modify.getCreator().getBlockBuilder();
            const agentStrings: string[] = await this.getAgentsState(department, url, userid, pat, http);
            for (let i = 0; i < agentStrings.length; i++) {
                blockBuilder.addSectionBlock({
                    text: blockBuilder.newPlainTextObject('- ' + agentStrings[i])
                });
            }

            blockBuilder.addActionsBlock({
                blockId: "close-forward",
                elements: [
                    blockBuilder.newButtonElement({
                        actionId: "close-" + room.id,
                        text: blockBuilder.newPlainTextObject("Close Chat"),
                        style: ButtonStyle.PRIMARY
                    }),
                ],
            });

            return context.getInteractionResponder().openModalViewResponse({
                blocks: blockBuilder.getBlocks(),
                title: blockBuilder.newPlainTextObject('Agents of selected department: ' + deptName)
            });
        }

        return context.getInteractionResponder().successResponse();
    }

    public async executeBlockActionHandler(context: UIKitBlockInteractionContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify) {
        const {
            actionId,
            triggerId,
            user,
            room,
            message
        } = context.getInteractionData();
        const url = await super.getAccessors().environmentReader.getEnvironmentVariables().getValueByName('ROOT_URL');
        const userId = await read.getEnvironmentReader().getSettings().getValueById('demoapp_admin_userid');
        const pat = await read.getEnvironmentReader().getSettings().getValueById('demoapp_admin_user_pat');


        if (actionId.startsWith('close-')) {
            const roomId = actionId.substring(6);
            const room = (await read.getRoomReader().getById(roomId));
            if (room) {
                const creator: IModifyCreator = modify.getCreator();
                const sender: IUser = (await read.getUserReader().getAppUser()) as IUser;
                const messageTemplate: IMessage = {
                    text: 'The room ' + roomId + ' is about to be closed.',
                    sender,
                    room
                };
                const messageBuilder: IMessageBuilder = creator.startMessage(messageTemplate);
                await creator.finish(messageBuilder);
                let header = {
                    'Content-Type': 'application/json',
                    'X-Auth-Token': pat,
                    'X-User-Id': userId
                };
                let closeUrl=url+'/api/v1/livechat/room.closeByUser';
                let payload={
                    'rid': roomId,
                    'comment': 'closed by button'
                };
                let response=this.processPost(closeUrl,payload,http,header);
                //add other http calls if you want
                return context.getInteractionResponder().successResponse();
            }

        }

        return {
            success: true,
        };
    }

    public async executeViewClosedHandler(context: UIKitViewCloseInteractionContext, read: IRead, http: IHttp, persistence: IPersistence, modify: IModify): Promise<IUIKitResponse> {
        return context.getInteractionResponder().successResponse();
    }



    private async getAgentsState(department: string, url: string, userId: string, pat: string, http: IHttp) {
        let header = {
            'Content-Type': 'application/json',
            'X-Auth-Token': pat,
            'X-User-Id': userId
        };
        let agents: string[] = await this.getAgents(department, url, header, http);
        let agentString: string[] = [];

        for (let i = 0; i < agents.length; i++) {
            let agent = agents[i];
            let response = await this.processGet(url + '/api/v1/users.info?username=' + agent, http, header);
            let responseObj = JSON.parse('' + response.content);
            agentString.push(agent + ' (' + responseObj.user.status + ') ');
        }
        return agentString;
    }


    private async getAgents(department: string, url: string, header: any, http: IHttp) {
        let response = await this.processGet(url + '/api/v1/livechat/department/' + department + '/agents', http, header);
        let responseObj = JSON.parse('' + response.content);
        let agents: string[] = [];
        for (let i = 0; i < responseObj.agents.length; i++) {
            let agent = responseObj.agents[i];
            agents.push(agent.username);
        }
        return agents;
    }



    async processGet(url: string, http: IHttp, apiHeaders: any): Promise<IHttpResponse> {
        return await http.get(url, {
            headers: apiHeaders
        });
    }

    async processPost(url: string, payload: any, http: IHttp,apiHeaders: any) {
        //console.log(url);
        //console.log(JSON.stringify(payload));

        return await http.post(url, {
            headers: apiHeaders,
            content: JSON.stringify(payload)
        });
    }



}
async function getISettingSelectValues(livechat: ILivechatRead): Promise<import("@rocket.chat/apps-engine/definition/settings").ISettingSelectValue[] | PromiseLike<import("@rocket.chat/apps-engine/definition/settings").ISettingSelectValue[] | undefined> | undefined> {
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

