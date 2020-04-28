exports.handler = async (event, context) => {
    return {
        statusCode: 200,
        body: `${process.env.DUMMY_VAR}`,
    }
}
