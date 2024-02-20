/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import * as vscode from "vscode";
import { ext } from '../extensionVariables';
import { agentDescription, agentFullName, agentName, maxFollowUps } from "./agentConsts";
import { agentHelpCommandName, getAgentHelpCommand } from "./agentHelpSlashCommand";
import { defaultBenchmarks, helpBenchmarks, multiPromptBenchmarks } from "./benchmarking/agentBenchmarks";
import { AgentBenchmarker } from "./benchmarking/benchmarking";
import { getLearnCommand } from "./commonCommandsAndHandlers";
import { appServiceExtensionSlashCommandsOwner, containerAppsExtensionSlashCommandsOwner, databasesExtensionCosmosDbSlashCommandsOwner, databasesExtensionPostgreSQLSlashCommandsOwner, functionsExtensionSlashCommandsOwner, staticWebAppsExtensionSlashCommandsOwner, storageExtensionSlashCommandsOwner, virtualMachinesExtensionSlashCommandsOwner } from "./extensions/extensions";
import { getRagStatusSlashCommand, toggleRagSlashCommand } from "./rag";
import { SlashCommandsOwner, type SlashCommandHandlerResult } from "./slashCommands";

export type AgentRequest = {
    command?: string;
    userPrompt: string;

    context: vscode.ChatContext;
    responseStream: vscode.ChatExtendedResponseStream;
    token: vscode.CancellationToken;
}

export interface IAgentRequestHandler {
    /**
     * Handles an agent request.
     *
     * Will only handle the request if:
     * - There is a command and it is in the list of invokeable commands OR
     * - Intent detection is not disabled and there is a prompt from which intent can be detected.
     *
     * @param request The request to handle.
     * @param handlerChain The chain of handlers that have been called so far.
     */
    handleRequestOrPrompt(request: AgentRequest, handlerChain: string[]): Promise<SlashCommandHandlerResult>;
    getFollowUpForLastHandledSlashCommand(result: vscode.ChatResult, token: vscode.CancellationToken): vscode.ChatFollowup[] | undefined;
}

/**
 * Owns slash commands that are knowingly exposed to the user.
 */
const agentSlashCommandsOwner = new SlashCommandsOwner({ noInput: agentHelpCommandName, default: getLearnCommand({ topic: "Azure" })[1].handler, });
agentSlashCommandsOwner.addInvokeableSlashCommands(new Map([
    appServiceExtensionSlashCommandsOwner.getTopLevelSlashCommand(),
    containerAppsExtensionSlashCommandsOwner.getTopLevelSlashCommand(),
    databasesExtensionCosmosDbSlashCommandsOwner.getTopLevelSlashCommand(),
    databasesExtensionPostgreSQLSlashCommandsOwner.getTopLevelSlashCommand(),
    functionsExtensionSlashCommandsOwner.getTopLevelSlashCommand(),
    staticWebAppsExtensionSlashCommandsOwner.getTopLevelSlashCommand(),
    storageExtensionSlashCommandsOwner.getTopLevelSlashCommand(),
    virtualMachinesExtensionSlashCommandsOwner.getTopLevelSlashCommand(),
    getAgentHelpCommand(agentSlashCommandsOwner),
]));

/**
 * Owns slash commands that are hidden from the user and related to benchmarking the agent.
 */
const agentBenchmarker = new AgentBenchmarker(agentSlashCommandsOwner);
agentBenchmarker.addBenchmarkConfigs(
    ...multiPromptBenchmarks,
    ...helpBenchmarks,
    ...defaultBenchmarks,
);
agentBenchmarker.addExtensionsToBenchmark(
    appServiceExtensionSlashCommandsOwner.getExtension(),
    containerAppsExtensionSlashCommandsOwner.getExtension(),
    databasesExtensionCosmosDbSlashCommandsOwner.getExtension(),
    databasesExtensionPostgreSQLSlashCommandsOwner.getExtension(),
    functionsExtensionSlashCommandsOwner.getExtension(),
    staticWebAppsExtensionSlashCommandsOwner.getExtension(),
    storageExtensionSlashCommandsOwner.getExtension(),
    virtualMachinesExtensionSlashCommandsOwner.getExtension(),
);

/**
 * Owns slash commands that are hidden from the user.
 */
const agentHiddenSlashCommandsOwner = new SlashCommandsOwner(
    { noInput: undefined, default: undefined },
    { disableIntentDetection: true }
);
agentHiddenSlashCommandsOwner.addInvokeableSlashCommands(new Map([toggleRagSlashCommand, getRagStatusSlashCommand]));

export function registerChatParticipant() {
    try {
        const agent2 = vscode.chat.createChatParticipant(agentName, handler);
        agent2.description = agentDescription;
        agent2.fullName = agentFullName;
        agent2.iconPath = vscode.Uri.joinPath(ext.context.extensionUri, "resources", "azure-color.svg");
        agent2.commandProvider = { provideCommands: getCommands };
        agent2.followupProvider = { provideFollowups: followUpProvider };
        agent2.isSticky = true;
    } catch (e) {
        console.log(e);
    }
}

async function handler(request: vscode.ChatRequest, context: vscode.ChatContext, responseStream: vscode.ChatExtendedResponseStream, token: vscode.CancellationToken): Promise<vscode.ChatResult | undefined> {
    const agentRequest: AgentRequest = {
        command: request.command,
        userPrompt: request.prompt,
        context: context,
        responseStream: responseStream,
        token: token,
    };
    const handlers = [agentHiddenSlashCommandsOwner, agentBenchmarker, agentSlashCommandsOwner];

    agentRequest.responseStream.progress("Processing request...");

    let handleResult: SlashCommandHandlerResult | undefined;
    for (const handler of handlers) {
        handleResult = await handler.handleRequestOrPrompt(agentRequest, []);
        if (handleResult !== undefined) {
            break;
        }
    }

    if (handleResult !== undefined) {
        handleResult.followUp = handleResult.followUp?.slice(0, maxFollowUps);
        return handleResult.chatAgentResult;
    } else {
        return undefined;
    }
}

function followUpProvider(result: vscode.ChatResult, token: vscode.CancellationToken): vscode.ProviderResult<vscode.ChatFollowup[]> {
    const providers = [agentHiddenSlashCommandsOwner, agentBenchmarker, agentSlashCommandsOwner];

    let followUp: vscode.ChatFollowup[] | undefined;
    for (const provider of providers) {
        followUp = provider.getFollowUpForLastHandledSlashCommand(result, token);
        if (followUp !== undefined) {
            break;
        }
    }
    return followUp || [];
}

function getCommands(_token: vscode.CancellationToken): vscode.ProviderResult<vscode.ChatCommand[]> {
    return agentSlashCommandsOwner.getSlashCommands().map(([name, config]) => ({ name: name, description: config.shortDescription }))
}
