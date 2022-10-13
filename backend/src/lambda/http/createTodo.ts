import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import 'source-map-support/register'
import * as middy from 'middy'
import { cors } from 'middy/middlewares'
import { CreateTodoRequest } from '../../requests/CreateTodoRequest'
import { getUserId } from '../utils';
import { createTodo } from '../../helpers/todos'
// import { TodoItem } from '../../models/TodoItem'
// import Axios from 'axios'
// import { storeS3Attachment } from '../../helpers/attachmentUtils'

// Access dynamodb client

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const newTodo: CreateTodoRequest = JSON.parse(event.body)
    // TODO: Implement creating a new TODO item

    const userId = getUserId(event);

    return await createTodo(userId, newTodo);

  }
)

handler.use(
  cors({
    credentials: true
  })
)
