import { GoogleGenAI, Type } from "@google/genai";

import { exec } from 'child_process'
import util from 'util'
import os from 'os'

import readlineSync from 'readline-sync'

import 'dotenv/config'


// Current OS (used in the system prompt)
const platform = os.platform()

// Promisified exec for async/await
const execute = util.promisify(exec)

// Gemini client
const ai = new GoogleGenAI({});


// Runs a shell command and returns a short string result
async function executeCommand({ command }) {
    try {
        const { stdout, stderr } = await execute(command)

        if (stderr) {
            return `Error: ${stderr}`
        }

        return `Success : ${stdout}`
    }
    catch (err) {
        return `Error: ${err}`
    }

}

// Tool schema for Gemini
const commandExecuter = {
    name: "executeCommand",
    description: "It takes any shell/terminal commnad and execute it . It will help us to create ,write, read, update, delete any folder and file",
    parameters: {
        type: Type.OBJECT,
        properties: {
            command: {
                type: Type.STRING,
                description: "It is the terminal/shell command. Ex: mkdir calculator, touch calculator/index.js etc"
            }
        },
        required: ['command']
    }
}
// Chat history for the model
const History = []

while (true) {
    const question = readlineSync.question("Ask me anything ==> ")

    if (question == 'exit') {
        break;
    }

    History.push({
        role: 'user',
        parts: [{ text: question }]
    })

    await buildWebsite(question);
}


async function buildWebsite() {
    while (true) {
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: History,
            config: {
                systemInstruction: `You are a website bulider , which will create the frontend part of the website using terminal/shell command.
            You will give shell/terminal commnad one by one and our tool will execute it 
            
            
            Give the commnad according to the Operating system we are using.
            My current Operating system is: ${platform}

            Use best practice for commands, it should handle multilne write also efficiently.

            Your Job
            1: Analyse the user query
            2:Take the neccessary action after analysing the query by giving proper command according to the user operating system

            Step By Step By Guide

            1: First you have to create the folder for the website which we have to create , example : mkdir calculator
            2:Give shell/terminal command to create html file, ex: touch calculator/index.html
            3:Give shell/terminal command to create Css file
            4:Give shell/terminal command to create javascript file
            5:Give shell/terminal command to write on html file
            6:Give shell/terminal command to write css file
            7:Give shell/terminal command to write javascript file
            8:Fix the error if they are present at any step by writing , updating or deleting
        `
                ,
                tools: [
                    {
                        functionDeclarations: [commandExecuter]
                    }
                ]

            },
        });

        if (result.functionCalls && result.functionCalls.length > 0) {

            const functionCall = result.functionCalls[0]
            const { name, args } = functionCall;

            const toolResponse = await executeCommand(args)

            const functionResponsePart = {
                name: functionCall.name,
                response: {
                    result: toolResponse,
                },
            };

            History.push({
                role: "model",
                parts: [
                    {
                        functionCall: functionCall,
                    },
                ],
            });

            History.push({
                role: "user",
                parts: [
                    {
                        functionResponse: functionResponsePart,
                    },
                ],
            });
        }
        else {
            console.log(result.text)
            History.push({
                role: 'model',
                parts: [{ text: result.text }]
            })
        }
    }
}

