import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { bucketName } from './todosAccess'

const XAWS = AWSXRay.captureAWS(AWS)

// TODO: Implement the fileStogare logic

const s3 = new XAWS.S3({
    signatureVersion: 'v4'
})

export async function storeS3Attachment(todoId: string, file: Buffer) {
    await s3
        .putObject({
            Bucket: bucketName,
            Key: `${todoId}.jpeg`,
            Body: file
        })
        .promise()
    
}