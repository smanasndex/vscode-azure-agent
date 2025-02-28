/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from "vscode";
import { type AgentRequest, type IAzureAgent } from "./AzureAgent";

export type BaseCommandConfig = {
    /**
     * A camel cased string that names the command.
     * @example "createNewFunctionProject"
     */
    name: string;

    /**
     * The VS Code command ID that this command maps to.
     * @example "azureFunctions.createNewFunctionProject"
     */
    commandId: string;

    /**
     * The display name of the command.
     * @example "Create New Function Project"
     */
    displayName: string;

    /**
     * A sentence description that helps a LLM understand when the command should be used.
     *
     * The description should give an understanding of what a user prompt which matches to this
     * command would look like. Give examples of terminology that the user might use, the type of
     * statements they might make, and the type of questions they might ask. Also consider giving
     * examples of what terminology or types of statements would not match to this command.
     *
     * For example:
     *
     * *This is best when users ask to create a Function App resource in Azure. They may refer
     * to a Function App as 'Function App', 'function', 'function resource', 'function app
     * resource', 'function app' etc. This command is not useful if the user is asking how to do something, or
     * if something is possible.*
     */
    intentDescription?: string;

    /**
     * If the command requires that a workspace is currently open.
     */
    requiresWorkspaceOpen?: boolean;

    /**
     * If the command requires that the user is logged into Azure.
     */
    requiresAzureLogin?: boolean;
}

/**
 * A config that describes a command that the extension implements which makes use of wizards that use
 * an {@link IAzureAgentInput}/{@link IAzureUserInput} to get user input.
 */
export type WizardCommandConfig = BaseCommandConfig & { type: "wizard"; };

/**
 * A config that describes a command that the extension implements which doesn't involve any additonal agent interaction
 * other than suggesting the command.
 */
export type SimpleCommandConfig = BaseCommandConfig & { type: "simple"; };

/**
 * A config that describes a command that the extension implements which is a skill command. When a skill command is invoked, the
 * associated command at {@link SkillCommandConfig.commandId} will be invoked. The arguments for the command will be a {@link SkillCommandArgs}.
 */
export type SkillCommandConfig = BaseCommandConfig & { type: "skill"; commandId: string; };

/**
 * Information that should be available on the package.json of an extension which is compabitible with the Azure agent.
 * This information should be placed in an `agentMetdata` property.
 */
export type ExtensionAgentMetadata = {
    version: "1.0";

    /**
     * The VS Code command ID of a command that the extension implements which can be used to get the list
     * of command configs that the extension implements and wishes to expose via the agent. The commands should be one of:
     * - {@link WizardCommandConfig}
     * - {@link SimpleCommandConfig}
     * - {@link SkillCommandConfig}
     */
    getCommandsCommandId: string;

    /**
     * The VS Code command ID of a command that the extension implements which can be used to run any of the {@link WizardCommandConfig}
     * commands the extension exposes, while only performing prompting/without actually executing the intent of the command.
     *
     * The command should take two parameters:
     * - A {@link WizardCommandConfig}: the command that should be run.
     * - A {@link IAzureAgentInput}: the input interface that the command should use.
     */
    runWizardCommandWithoutExecutionCommandId?: string;

    /**
     * The VS Code command ID of a command that the extension implements which can be used to run any of the {@link WizardCommandConfig}
     * commands the extension exposes, with a {@link AzureUserInputQueue} of inputs,
     *
     * The command should take two parameters:
     * - A {@link WizardCommandConfig}: the command that should be run.
     * - A {@link AzureUserInputQueue}: the inputs that the command should use when needing to present user input.
     */
    runWizardCommandWithInputsCommandId?: string;

    /**
     * The VS Code command ID of a command that the extension implements which can be used to get the list of
     * {@link AgentBenchmarkConfig}s that the extension defines. These benchmarks should serve as a way to benchmark
     * the performance of the agent with regards to functionality that the subcommands associated with the extension
     * expose.
     */
    getAgentBenchmarkConfigsCommandId?: string;
};


export type AgentBenchmarkStepConfig = {
    /**
     * The simulated user input to be given to the agent when running the step.
     */
    prompt: string;

    /**
     * Acceptable handler chains for the `prompt`. Each entry in a handler chain is a string that represents a handler, in the
     * order that the handlers are called. For {@link WizardCommandConfig} related subcommands, the {@link WizardCommandConfig.name}
     * is the handler name.
     */
    acceptableHandlerChains: string[][];

    /**
     * Follow ups that are required/optional to be returned by the agent given the {@link AgentBenchmarkStepConfig.prompt}.
     */
    followUps?: {
        required: { type: "message", messageContains: string }[],
        optional: { type: "message", messageContains: string }[],
    };

    /**
     * Buttons that are required/optional to be returned by the agent given the {@link AgentBenchmarkStepConfig.prompt}.
     */
    buttons?: {
        required: { type: "command", commandId: string }[],
        optional: { type: "command", commandId: string }[],
    }
};

/**
 * A config that describes a benchmark which has multiple steps to be run against the agent.
 */
export type AgentBenchmarkWithStepsConfig = {
    /**
     * The name of the benchmark. Does not need to be unique, but is useful if it can be.
     */
    name: string;
    steps: AgentBenchmarkStepConfig[];
};

/**
 * @deprecated Use {@link AgentBenchmarkWithStepsConfig} instead.
 *
 * A config that describes a benchmark to be run against the agent.
 */
export type AgentBenchmarkConfig = AgentBenchmarkStepConfig & {
    /**
     * The name of the benchmark. Does not need to be unique, but is useful if it can be.
     */
    name: string;
};

export type SkillCommandArgs = {
    agentRequest: AgentRequest;
    agent: IAzureAgent;
};

export type SkillCommandResult = {
    /**
     * The VsCode chat agent result.
     */
    chatAgentResult: Omit<vscode.ChatResult, 'metadata'> & { metadata: SkillCommandResultMetadata };

    /**
     * Any follow-up messages to be given for this result.
     */
    followUp?: vscode.ChatFollowup[],
};

export type SkillCommandResultMetadata = {
    /**
     * The chain of slash command handlers that were invoked to produce this result. Will be populated by the agent.
     */
    handlerChain?: string[]

    /**
     * A unique identifier for the result. Will be populated by the agent.
     */
    resultId?: string;

    /**
     * Any additional metadata that the skill command handler wants to attach to the result.
     */
    [key: string]: unknown;
};
