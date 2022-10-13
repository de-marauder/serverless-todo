import * as AWS from 'aws-sdk'
// import * as AWSXRay from 'aws-xray-sdk'
const AWSXRay = require('aws-xray-sdk');
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { createLogger } from '../utils/logger'
import * as uuid from 'uuid'
import { TodoItem } from '../models/TodoItem'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'

export const XAWS = AWSXRay.captureAWS(AWS)

export const logger = createLogger('TodosAccess')

// TODO: Implement the dataLayer logic

export const s3 = new AWS.S3({
    signatureVersion: 'v4'
})

export const todoTable = process.env.TODOS_TABLE;
export const todoCreatedAtIndex = process.env.TODOS_CREATED_AT_INDEX;

export const bucketName = process.env.ATTACHMENT_S3_BUCKET
export const urlExpiration = process.env.SIGNED_URL_EXPIRATION

const cloudWatch = new XAWS.CloudWatch()

async function putMetric(metricName: string, serviceValue: string, value: number, metricUnit: string) {

    await cloudWatch.putMetricData({
        MetricData: [ // A list of data points to send
            {
                MetricName: metricName, // Name of a metric
                Dimensions: [ // A list of key-value pairs that can be used to filter metrics from CloudWatch
                    {
                        Name: 'serviceName',
                        Value: serviceValue
                    }
                ],
                Unit: metricUnit, // Unit of a metric
                Value: value // Value of a metric to store
            }
        ],
        Namespace: "de-marauder's Inc" // An isolated group of metrics
    }).promise()

}

export class TodosAccess {

    constructor(
        private readonly docClient: DocumentClient = createDynamoDBClient(),
        private readonly todoTable = process.env.TODOS_TABLE,
        // private readonly todoCreatedAtIndex = process.env.TODOS_CREATED_AT_INDEX
    ) {
    }

    async createTodo(userId: string, newTodo: CreateTodoRequest) {
        const todoId = uuid.v4()
        // create todo item
        const todo: TodoItem = {
            ...newTodo,
            userId: userId,
            todoId: todoId,
            createdAt: new Date().toISOString(),
            done: false,
            attachmentUrl: `https://serverless-c4-todo-images-bbfe-dev.s3.amazonaws.com/${todoId}`
        }

        let latencyValue = new Date().getTime()
        let successValue = 1;

        try {
            // access the client's put method
            await this.docClient.put({
                TableName: this.todoTable,
                Item: todo,
            }).promise()

            latencyValue = new Date().getTime() - latencyValue;

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')
            await putMetric('Success', this.todoTable, successValue, 'Count')

            // return proper status codes if successfull
            return {
                statusCode: 201,
                body: JSON.stringify({
                    item: todo
                })
            };

        } catch (error) {

            console.log('Unable to put document into dynamo DB', error.message)

            successValue = 0
            latencyValue = new Date().getTime() - latencyValue;

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')
            await putMetric('Success', this.todoTable, successValue, 'Count')

            return {
                statusCode: 412,
                body: JSON.stringify({
                    message: `Unable to put document into dynamo DB, \n ${error.message}`
                })
            };
        }
    }

    async deleteTodo(todoId: string, userId: string) {

        let latencyValue = new Date().getTime()
        let successValue = 1;

        // Get todo
        const todo = await this.docClient.get({
            TableName: this.todoTable,
            Key: {
                'userId': userId,
                'todoId': todoId,
            }
        }).promise()

        // exit if todo does not exist
        if (!todo) {
            return {
                statusCode: 412,
                body: JSON.stringify({
                    message: `Item does not exist`
                })
            };
        }


        // Attempt todo deletion
        try {

            await this.docClient.delete({
                TableName: this.todoTable,
                Key: {
                    'userId': userId,
                    'todoId': todoId,
                }
            }).promise()

            latencyValue = new Date().getTime() - latencyValue

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')
            await putMetric('Success', this.todoTable, successValue, 'Count')

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'success'
                })
            };

        } catch (error) {
            console.log(`Unable to delete item from dynamo DB ${error.message}`)

            successValue = 0;
            latencyValue = new Date().getTime() - latencyValue;

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')

            await putMetric('Success', this.todoTable, successValue, 'Count')

            return {
                statusCode: 412,
                body: JSON.stringify({
                    message: `Unable to delete item from dynamo DB ${error.message}`
                })
            };
        }
    }

    async getTodosForUser(userId: string) {

        let latencyValue = new Date().getTime()
        let successValue = 1;

        try {
            const todos = await this.docClient.query({
                TableName: this.todoTable,
                ExpressionAttributeValues: {
                    ':userId': userId
                },
                KeyConditionExpression: 'userId = :userId',
            }).promise()

            latencyValue = new Date().getTime() - latencyValue

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')
            await putMetric('Success', this.todoTable, successValue, 'Count')

            return {
                statusCode: 200,
                body: JSON.stringify({
                    items: todos.Items
                })
            };

        } catch (error) {
            console.log(`Unable to get items from dynamo DB ${error.message}`)

            successValue = 0
            latencyValue = new Date().getTime() - latencyValue;

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')
            await putMetric('Success', this.todoTable, successValue, 'Count')

            return {
                statusCode: 412,
                body: JSON.stringify({
                    message: `Unable to get items from dynamo DB ${error.message}`
                })
            };
        }
    }

    updateTodo = async function (todoId: string, updateTodo: UpdateTodoRequest, userId: string) {

        let latencyValue = new Date().getTime()
        let successValue = 1;

        // check if todo belongs to logged in user
        var fetchedTodo: DocumentClient.GetItemOutput | null;
        try {

            fetchedTodo = await this.docClient.get({
                Key: {
                    'userId': userId,
                    'todoId': todoId,
                },
                TableName: this.todoTable,
            }).promise()

        } catch (error) {
            console.log('There was an error reading data from dynamo DB', error.message);

        }

        // If todo does not belong to user return error
        if (fetchedTodo?.Item?.userId !== userId) {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    message: `You are not authorized to perform this action. Todo does not belong to`
                })
            };
        }


        let updateExpression = 'set '
        let expressionAttributeNames = {};
        let expressionAttributeValues = {};

        for (const item in updateTodo) {
            updateExpression += ` #${item} = :${item} ,`;
            expressionAttributeNames['#' + item] = item;
            expressionAttributeValues[':' + item] = updateTodo[item];
        }

        updateExpression = updateExpression.slice(0, -1)

        const params = {
            TableName: this.todoTable,
            IndexName: this.todoCreatedAtIndex,
            Key: {
                'userId': userId,
                'todoId': todoId,
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        };

        try {

            await this.docClient.update(params).promise()

            latencyValue = new Date().getTime() - latencyValue

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')
            await putMetric('Success', this.todoTable, successValue, 'Count')

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'success'
                })
            };

        } catch (error) {
            console.log(`Unable to perform update \n${error.message}`)

            successValue = 0;
            latencyValue = new Date().getTime() - latencyValue;

            await putMetric('Latency', this.todoTable, latencyValue, 'Milliseconds')
            await putMetric('Success', this.todoTable, successValue, 'Count')

            return {
                statusCode: 403,
                body: JSON.stringify({
                    message: `You are not authorized to perform this action. Todo does not belong to`
                })
            };
        }

    }
}

function createDynamoDBClient(): DocumentClient {
    if (process.env.IS_OFFLINE) {
        console.log('Creating a local DynamoDB instance')
        return new XAWS.DynamoDB.DocumentClient({
            region: 'localhost',
            endpoint: 'http://localhost:8000'
        })
    }

    return new XAWS.DynamoDB.DocumentClient()
}