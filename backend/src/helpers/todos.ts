import { CreateTodoRequest } from '../requests/CreateTodoRequest';
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest';
import { TodosAccess } from '../helpers/todosAccess';
import {
    s3,
    bucketName,
    urlExpiration,
} from './todosAccess'



// import { AttachmentUtils } from './attachmentUtils';
// import { createLogger } from '../utils/logger'
// import * as createError from 'http-errors'

// TODO: Implement businessLogic

const todosAccess = new TodosAccess();


export const createTodo = async function (userId: string, newTodo: CreateTodoRequest) {

    return await todosAccess.createTodo(userId, newTodo)

}

export const deleteTodo = async function (todoId: string, userId: string) {

    return await todosAccess.deleteTodo(todoId, userId)
}

export const getTodosForUser = async function (userId: string) {

    return await todosAccess.getTodosForUser(userId)

}

export const updateTodo = async function (todoId: string, updateTodo: UpdateTodoRequest, userId: string) {

    return await todosAccess.updateTodo(todoId, updateTodo, userId)

}

export const createAttachmentPresignedUrl = async function (todoId: string) {

    let signedUrl: string;
    try {
        signedUrl = s3.getSignedUrl('putObject', {
            Bucket: bucketName,
            Key: todoId,
            Expires: +urlExpiration
        })

    } catch (error) {
        console.log("< ==== Error: ===== >\n", error.stack)
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            uploadUrl: signedUrl
        })
    };
}