import express, {Express} from 'express'
import {Server} from 'http'
import {GraphQLServer} from '../src/'
import fetch from 'cross-fetch'
import {JsonLogger} from '../src'
import {
    usersRequest,
    usersQuery,
    userSchema,
    loginRequest,
    logoutMutation,
    returnErrorQuery,
    userSchemaResolvers,
    userOne,
    userTwo,
    userQuery,
    userVariables
} from './ExampleSchemas'
import {GraphQLError} from 'graphql'
import {generateGetParamsFromGraphQLRequestInfo} from './TestHelpers'
import {GraphQLServerOptions} from '../src';

const graphQLServerPort = 3000
const logger = new JsonLogger('test-logger', 'myTestService')
const initialGraphQLServerOptions: GraphQLServerOptions = {schema: userSchema, rootValue: userSchemaResolvers, logger: logger, debug: true}
let customGraphQLServer: GraphQLServer
let graphQLServer: Server


beforeAll(async () => {
    graphQLServer = setupGraphQLServer().listen({port: graphQLServerPort})
    console.info(`Starting GraphQL server on port ${graphQLServerPort}`)
})

afterAll(async () => {
    await graphQLServer.close()
})

test('Should get data response', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: `{"query":"${usersQuery}"}`, headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.data.users).toStrictEqual([userOne, userTwo])
})

test('Should get data response for query with variables', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: `{"query":"${userQuery}", "variables":${userVariables}}`, headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.data.user).toStrictEqual(userOne)
})

test('Should get data response when using a mutation', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: `{"query":"${logoutMutation}"}`, headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.data.logout.result).toBe('Goodbye!')
})

test('Should get error response if query does not match expected query format', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"unknown"}', headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Syntax Error: Unexpected Name "unknown".')
})

test('Should get error response if body does not contain query information', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"aField":"aValue"}', headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Request cannot be processed. No query was found in parameters or body.')
})

test('Should get error response if body contains invalid json', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":{"unknown"}', headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('POST body contains invalid JSON.')
})

test('Should get error response if content type cannot be processed', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"unknown"}', headers: {
        'Content-Type': 'application/specialapp'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe( 'POST body contains invalid content type: application/specialapp.')
})

test('Should get error response if a validation error occurrs ', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"query users{ users { userIdABC userName } }"}', headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe( 'Cannot query field "userIdABC" on type "User". Did you mean "userId" or "userName"?')
})

test('Should get error response if charset could not be processed', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"unknown"}', headers: {
        'Content-Type': 'application/json; charset=utf-4711'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Unsupported charset "UTF-4711".')
})

test('Should get error response if request contains gzip encoding but body does not match', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"unknown"}', headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Invalid request body: Error: incorrect header check.')
})

test('Should get error response if request contains deflate encoding but body does not match', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"unknown"}', headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'deflate'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Invalid request body: Error: incorrect header check.')
})

test('Should get error response if request contains unknown encoding', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"unknown"}', headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'rar'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Unsupported content-encoding "rar".')
})

test('Should get error response if content type is not set', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"query":"unknown"}', headers: {
        'Content-Type': ''
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Content type could not be parsed.')
})

test('Should get error response when GraphQL context error occurs when calling execute function', async () => {
    //Change options to let executeFunction return an error
    customGraphQLServer.setOptions({schema: userSchema, rootValue: userSchemaResolvers, logger: logger, debug: true, executeFunction: () => {throw new GraphQLError('A GraphQL context error occurred!')} })
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: `{"query":"${usersQuery}"}`, headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('A GraphQL context error occurred!')
    customGraphQLServer.setOptions(initialGraphQLServerOptions)
})

test('Should get error response if resolver returns GraphQL error', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: `{"query":"${returnErrorQuery}"}`, headers: {
        'Content-Type': 'application/json'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Something went wrong!')
})

test('Should get data response when using GET request', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql?${generateGetParamsFromGraphQLRequestInfo(usersRequest)}`)
    const responseObject = await response.json()
    expect(responseObject.data.users).toStrictEqual([userOne, userTwo])
})

test('Should get error response when using mutation in a GET request', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql?${generateGetParamsFromGraphQLRequestInfo(loginRequest)}`)
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Operation mutation is only allowed in POST requests')
})

test('Should get an error response when content type is not defined', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql?aField=aValue` )
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Invalid request. Request header content-type is undefined.')
})

test('Should get data response when using urlencoded request', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: generateGetParamsFromGraphQLRequestInfo(usersRequest), headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }})
    const responseObject = await response.json()
    expect(responseObject.data.users).toStrictEqual([userOne, userTwo])
    //expect(responseObject.errors).toBe('Error')
})

test('Should get error response when using urlencoded request with no query provided', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: '{"unknown":"unknown"}', headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Request cannot be processed. No query was found in parameters or body.')
})

test('Should get data response for application graphql request', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: usersQuery, headers: {
        'Content-Type': 'application/graphql'
    }})
    const responseObject = await response.json()
    expect(responseObject.data.users).toStrictEqual([userOne, userTwo])
})

test('Should get error response if invalid schema is used', async () => {
    //Change options to use schema validation function that always returns a validation error
    customGraphQLServer.setOptions({schema: userSchema, logger: logger, debug: true, schemaValidationFunction: () => [new GraphQLError('Schema is not valid!')] })
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'POST', body: 'doesnotmatter'})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('Request cannot be processed. Schema in GraphQL server is invalid.')
    customGraphQLServer.setOptions(initialGraphQLServerOptions)
})

test('Should get error response if invalid method is used', async () => {
    const response = await fetch(`http://localhost:${graphQLServerPort}/graphql`, {method: 'PUT', body: 'doesnotmatter'})
    const responseObject = await response.json()
    expect(responseObject.errors[0].message).toBe('GraphQL server only supports GET and POST requests.')
    const allowResponseHeader = response.headers.get('Allow')
    expect(allowResponseHeader).toBe('GET, POST')
})

function setupGraphQLServer(): Express {
    const graphQLServerExpress = express()
    customGraphQLServer = new GraphQLServer(initialGraphQLServerOptions)
    graphQLServerExpress.all('/graphql', (req, res) => {
        return customGraphQLServer.handleRequest(req, res)
    })
    return graphQLServerExpress
}

