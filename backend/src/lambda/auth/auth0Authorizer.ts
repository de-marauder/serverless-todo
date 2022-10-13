import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import 'source-map-support/register'

import { verify, decode } from 'jsonwebtoken'
import { createLogger } from '../../utils/logger'
import axios from 'axios'
import { Jwt } from '../../auth/Jwt'
import { JwtPayload } from '../../auth/JwtPayload'
import { certToPEM } from './certToPem'

const logger = createLogger('auth')

// TODO: Provide a URL that can be used to download a certificate that can be used
// DONE
// to verify JWT token signature.
// To get this URL you need to go to an Auth0 page -> Show Advanced Settings -> Endpoints -> JSON Web Key Set
const jwksUrl = 'https://dev-aojf4w1b.us.auth0.com/.well-known/jwks.json'

export const handler = async (
  event: CustomAuthorizerEvent
): Promise<CustomAuthorizerResult> => {
  logger.info('Authorizing a user', event.authorizationToken)
  try {
    const jwtToken = await verifyToken(event.authorizationToken)
    logger.info('User was authorized', jwtToken)

    if (!jwtToken) throw new Error('Invalid JWT token.')
    return {
      principalId: jwtToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }

  } catch (e) {
    logger.error('User not authorized', { error: e.message })

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
}

async function verifyToken(authHeader: string): Promise<JwtPayload | void> {
  const token = getToken(authHeader)
  const jwt: Jwt = decode(token, { complete: true }) as Jwt
  console.log('jwt: ', jwt);

  // TODO: Implement token verification
  // DONE
  // You should implement it similarly to how it was implemented for the exercise for the lesson 5
  // You can read more about how to do this here: https://auth0.com/blog/navigating-rs256-and-jwks/

  // Get JWKS using axios
  const JWKS = await axios.get(jwksUrl);

  // Filter for kid properties
  console.log("\n<== JWKS.data.keys: ==> \n", JWKS.data.keys)
  const signedKeys = JWKS.data.keys.filter((key) => (
    key.use === 'sig' // JWK property `use` determines the JWK is for signature verification
    && key.kty === 'RSA' // We are only supporting RSA (RS256)
    && key.kid           // The `kid` must be present to be useful for later
    && ((key.x5c && key.x5c.length) || (key.n && key.e)) // Has useful public keys
  )).map((key) => {
    return { kid: key.kid, nbf: key.nbf, publicKey: certToPEM(key.x5c[0]) };
  })
  console.log("\n=====Signed Keys: =====\n", signedKeys)

  // throw an error if there are no signed keys
  if (!signedKeys.length) {
    console.log('The JWKS endpoint did not contain any signature verification keys')
    return
  }

  // Find the certificate that corresponds to the jwt using the key IDs
  const cert = signedKeys.find((key) => key.kid == jwt.header.kid)
  console.log("\n=====Found Cert: =====\n", cert)

  // verify jwt using certificate
  return verify(
    token,
    cert.publicKey,
    { algorithms: ['RS256'] }
  ) as JwtPayload

}

function getToken(authHeader: string): string {
  if (!authHeader) throw new Error('No authentication header')

  if (!authHeader.toLowerCase().startsWith('bearer '))
    throw new Error('Invalid authentication header')

  const split = authHeader.split(' ')
  const token = split[1]

  return token
}
