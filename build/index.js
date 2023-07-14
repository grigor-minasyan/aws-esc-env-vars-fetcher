#!/usr/bin/env node
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
const utils_1 = require("./utils");
const p_limit_1 = __importDefault(require("p-limit"));
const inquirer_1 = __importDefault(require("inquirer"));
const cli_progress_1 = __importDefault(require("cli-progress"));
(() => __awaiter(void 0, void 0, void 0, function* () {
    // Setting AWS profile
    const answers = yield inquirer_1.default.prompt([
        {
            type: "input",
            name: "awsProfile",
            message: "Enter AWS profile name",
            default: "asurion-simplr-nonprod_dev",
        },
    ]);
    process.env["AWS_PROFILE"] = answers.awsProfile;
    // getting keywords for search
    const { keywords } = (yield inquirer_1.default.prompt([
        {
            type: "input",
            name: "keywords",
            message: "Enter space separated keywords to search for container names",
            default: "logic processor qa",
        },
    ]));
    const allContainerNames = yield (0, utils_1.getAllContainerNames)();
    const filteredContainerNames = allContainerNames.filter((containerName) => keywords
        .toLowerCase()
        .split(" ")
        .every((keyword) => containerName.toLowerCase().includes(keyword)));
    const { containerName } = (yield inquirer_1.default.prompt([
        {
            type: "list",
            name: "containerName",
            message: "Select container name",
            choices: filteredContainerNames,
        },
    ]));
    const taskDefName = yield (0, utils_1.getTaskDefinitionName)(containerName);
    let finalEnv = "# Non secret environment\n\n";
    const simplrServerEnv = yield (0, utils_1.getContainerDefinition)(taskDefName);
    simplrServerEnv.environment.forEach((env) => {
        finalEnv += `${env.name}=${env.value}\n`;
    });
    finalEnv += "\n# Secrets\n\n";
    const limit = (0, p_limit_1.default)(5);
    const progressBar = new cli_progress_1.default.SingleBar({}, cli_progress_1.default.Presets.shades_classic);
    progressBar.start(simplrServerEnv.secrets.length, 0);
    let progress = 0;
    const envVarsToAppend = yield Promise.all(simplrServerEnv.secrets.map((secret) => limit(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!secret.valueFrom) {
            throw new Error("No valueFrom found");
        }
        const value = yield (0, utils_1.getParameter)(secret.valueFrom);
        progressBar.update(++progress);
        return `${secret.name}=${value}\n`;
    }))));
    progressBar.stop();
    envVarsToAppend.forEach((envVar) => (finalEnv += envVar));
    console.log("# ------------------------------------------------------------------------------------------------------------------------------------");
    console.log(finalEnv);
    console.log("# ------------------------------------------------------------------------------------------------------------------------------------");
}))();
