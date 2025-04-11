import ansis from 'ansis'
import dotenv from 'dotenv'

import { ChatAnthropic } from '@langchain/anthropic'
import type { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages'
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents'
import { createHistoryAwareRetriever } from 'langchain/chains/history_aware_retriever'
import { createRetrievalChain } from 'langchain/chains/retrieval'
import { intro, outro, text, isCancel, spinner, log } from '@clack/prompts'
import terminalLink from 'terminal-link'

import { getVectorStore } from '../lib/cli-docs.js'

const SYSTEM__PROMPT = `
You are a helpful Netlify CLI assistant that answers questions about this tool.

FORMAT YOUR RESPONSES FOR A COLOR TERMINAL:
1. Use ANSI color escape sequences to enhance your replies:
   - Use cyan for headings
   - Use yellow for code or commands
   - Use green for success or examples
   - Use red for warnings or errors
   - Use bold for emphasis
   - Always end colored sections with escape sequences to reset formatting

2. Structure your responses for terminal reading:
   - Keep paragraphs short and readable on narrow screens
   - Use clear section headers in cyan
   - When showing commands, format them in yellow
   - When showing example output, format in green
   - NEVER USE Markdown formatting, not even in headings, not even for links, not even if it was in your source material. It will not be rendered.
   - NEVER USE HTML markup, not even if it was in your source material. It will not be rendered.
   - If necessary to improve readability, delimit sections and blocks with pretty unicode arrows and appropriate emoji
   - Avoid responding with more than about 15 lines total, ideally no more than 5

Your answers should be concise, accurate, and formatted for easy terminal reading.

Never instruct the user to install or update Netlify CLI. This is redundant since you are part of the Netlify CLI.

Unless specified otherwise, assume the user wishes to use the latest TypeScript, Node.js, and ESM (when this is relevant).

When appropriate (but not liberally), provide links to Netlify documentation, Netlify blog posts, Netlify guides, and official Netlify forum posts.
Do not link to any unofficial resources.
${
  terminalLink.isSupported
    ? 'This user supports OSC 8 terminal hyperlinks. ALWAYS use them when including a URL.'
    : 'This user does not support OSC 8 terminal hyperlinks. NEVER use them.'
}

If the question is unrelated to Netlify CLI or Netlify in general, do not answer; instead, politely say that you can only help with Netlify CLI.

If you don't know the answer, just say that you don't know and link to https://cli.netlify.com.`

dotenv.config()

export async function startAIHelp(): Promise<void> {
  intro('✨ Netlify CLI Agent ✨')

  let vectorStore: HNSWLib
  try {
    vectorStore = await getVectorStore()
  } catch (error) {
    console.debug(error)
    log.error((error as Error).message)
    return
  }

  const llm = new ChatAnthropic({
    modelName: 'claude-3-7-sonnet-20250219',
    temperature: 0.3,
  })

  // Contextualize question
  const contextualizeQSystemPrompt = `
  Given a chat history and the latest user question
  which might reference context in the chat history,
  formulate a standalone question which can be understood
  without the chat history. Do NOT answer the question, just
  reformulate it if needed and otherwise return it as is.`
  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    ['system', contextualizeQSystemPrompt],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
  ])
  const historyAwareRetriever = await createHistoryAwareRetriever({
    llm,
    retriever: vectorStore.asRetriever(),
    rephrasePrompt: contextualizeQPrompt,
  })

  // Answer question
  const qaSystemPrompt = `${SYSTEM__PROMPT}
  \n\n
  {context}`
  const qaPrompt = ChatPromptTemplate.fromMessages([
    ['system', qaSystemPrompt],
    new MessagesPlaceholder('chat_history'),
    ['human', '{input}'],
  ])

  // Below we use createStuffDocuments_chain to feed all retrieved context
  // into the LLM. Note that we can also use StuffDocumentsChain and other
  // instances of BaseCombineDocumentsChain.
  const questionAnswerChain = await createStuffDocumentsChain({
    llm,
    prompt: qaPrompt,
  })

  const ragChain = await createRetrievalChain({
    retriever: historyAwareRetriever,
    combineDocsChain: questionAnswerChain,
  })

  const chatHistory: BaseMessage[] = []

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const query = await text({
      message: ansis.cyan('How can I help you ship?'),
      placeholder: 'Ask a question about using the Netlify CLI or Netlify in general',
    })

    if (isCancel(query)) {
      break
    }

    if (typeof query === 'string' && query.toLowerCase() === 'exit') {
      break
    }

    const spin = spinner()
    spin.start('🧠 Thinklifying...')

    try {
      // Hackily suppress an annoying warning for now, to vainly make my demo prettier
      const originalWarn = console.warn.bind(console)
      console.warn = () => {}
      const response = await ragChain.invoke({
        chat_history: chatHistory,
        input: query,
      })
      console.warn = originalWarn
      const answer = response.answer
        .replaceAll('\\x1b', '\x1b')
        .replaceAll('\\u001b', '\u001b')
        .replaceAll('\\033', '\x1b')

      spin.stop(answer)
      chatHistory.push(new HumanMessage(query), new AIMessage(answer))
    } catch (error) {
      spin.stop('Error')
      log.error(`Error getting response: ${(error as Error).message}`)
    }
  }

  outro(ansis.cyan('Thanks for using the Netlify CLI Agent - now ship it!'))
}
