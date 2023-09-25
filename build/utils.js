"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContainerDefinition = exports.getAllContainerNames = exports.getParameter = exports.getTaskDefinitionName = void 0;
const client_ssm_1 = require("@aws-sdk/client-ssm");
const client_ecs_1 = require("@aws-sdk/client-ecs");
const inquirer_1 = __importDefault(require("inquirer"));
const _SSMClient = new client_ssm_1.SSMClient({ region: "us-east-1" });
const _ECSClient = new client_ecs_1.ECSClient({ region: "us-east-1" });
function getTaskDefinitionName(containerName) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield _ECSClient.send(new client_ecs_1.ListTaskDefinitionsCommand({
            familyPrefix: containerName,
            status: "ACTIVE",
            sort: "DESC",
            maxResults: 1,
        }));
        const taskDefName = (_b = (_a = res === null || res === void 0 ? void 0 : res.taskDefinitionArns) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.split("/")[1];
        if (!taskDefName) {
            throw new Error("No task definition found");
        }
        return taskDefName;
    });
}
exports.getTaskDefinitionName = getTaskDefinitionName;
function getParameter(name) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const input = {
            // GetParameterequest
            Name: name.replace("arn:aws:ssm:us-east-1:080007210919:parameter/", ""),
            WithDecryption: true,
        };
        const command = new client_ssm_1.GetParameterCommand(input);
        try {
            const response = yield _SSMClient.send(command);
            if (!((_a = response.Parameter) === null || _a === void 0 ? void 0 : _a.Value)) {
                throw new Error(`No value found for ${name}`);
            }
            return response.Parameter.Value;
        }
        catch (e) {
            return "";
        }
    });
}
exports.getParameter = getParameter;
function getAllContainerNames() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("getting all container names");
        const results = [];
        let res = yield _ECSClient.send(new client_ecs_1.ListTaskDefinitionFamiliesCommand({ status: "ACTIVE" }));
        if (!res.families) {
            throw new Error("No families found");
        }
        results.push(...res.families);
        while (res.nextToken) {
            res = yield _ECSClient.send(new client_ecs_1.ListTaskDefinitionFamiliesCommand({
                status: "ACTIVE",
                nextToken: res.nextToken,
            }));
            results.push(...((res === null || res === void 0 ? void 0 : res.families) || []));
        }
        return results;
    });
}
exports.getAllContainerNames = getAllContainerNames;
function getContainerDefinition(taskDefName) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        // getting the task definition description
        const { taskDefinition } = yield _ECSClient.send(new client_ecs_1.DescribeTaskDefinitionCommand({
            taskDefinition: taskDefName,
        }));
        if (!((_a = taskDefinition === null || taskDefinition === void 0 ? void 0 : taskDefinition.containerDefinitions) === null || _a === void 0 ? void 0 : _a[0])) {
            throw new Error("No container definition found");
        }
        let containerIndex = 0;
        if (taskDefinition.containerDefinitions.length > 1) {
            // inquire the user to select the index of the container definition
            containerIndex = (yield inquirer_1.default.prompt([
                {
                    type: "list",
                    name: "containerIndex",
                    message: "Select container index",
                    choices: taskDefinition.containerDefinitions.map(({ name }, index) => ({
                        name: name || `Container ${index}`,
                        value: index,
                    })),
                },
            ])).containerIndex;
        }
        const containerDef = {
            environment: taskDefinition.containerDefinitions[containerIndex].environment || [],
            secrets: taskDefinition.containerDefinitions[containerIndex].secrets || [],
        };
        const sortStringAsc = (a, b) => { var _a; return ((_a = a.name) === null || _a === void 0 ? void 0 : _a.localeCompare(b.name || "")) || 0; };
        containerDef.environment.sort(sortStringAsc);
        containerDef.secrets.sort(sortStringAsc);
        return containerDef;
    });
}
exports.getContainerDefinition = getContainerDefinition;
