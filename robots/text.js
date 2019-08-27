const algorithmia = require('algorithmia');
const apiKeyAlgorithmia = require('../credentials/algorithmia.json').apiKey
const sbd = require('sbd')

const watsonApiKey = require('../credentials/watson-nlu.json').apiKey
var NaturalLanguageUnderstandingV1 = require('../node_modules/watson-developer-cloud/natural-language-understanding/v1.js');

const state = require('./state.js')
 
const nlu = new NaturalLanguageUnderstandingV1({
    iam_apikey: watsonApiKey,
    username: 'apikey',
    password: 'RgoRxUvI7A29mgOE6XUq4_qVUU9f_E-XMuc4o3QzUZnK',
    version: '2018-04-05',
    url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
  })
  
async function robot(){
    const content = state.load()
    
    await fetchContentFromWikipedia(content)
    sanitizedContent(content)
    breakContentIntoSentences(content)
    limitMaximumSentences(content)
    await fetchKeywordsOfAllSentences(content)

    state.save(content)

    async function fetchContentFromWikipedia(content){
        const algorithmiaAutenticad = algorithmia(apiKeyAlgorithmia)
        const wikipediaAlgorithm = algorithmiaAutenticad.algo('web/WikipediaParser/0.1.2?timeout=300')
        const wikipediaResponde = await wikipediaAlgorithm.pipe(content.searchTerm)
        const wikipediaContent = wikipediaResponde.get()
        
        content.sourceContentOriginal = wikipediaContent.content
    }

    function sanitizedContent(content){
        const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
        const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)

        content.sourceContentSanatized = withoutDatesInParentheses

        function removeBlankLinesAndMarkdown(text){
            const allLines = text.split('\n')
            
            const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
                if(line.trim().length === 0 || line.trim().startsWith('=')){
                    return false
                }
                    return true
            })
            
            return withoutBlankLinesAndMarkdown.join(' ')
        }

        function removeDatesInParentheses(text){
            return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g,' ')
        }
    }

    function breakContentIntoSentences(content){
        content.sentences = []

        const sentences = sbd.sentences(content.sourceContentSanatized)
        sentences.forEach((sentence) => {
            content.sentences.push({
                text: sentence,
                keywords: [],
                images: []
            })
        })
    }

    function limitMaximumSentences(content){
        content.sentences = content.sentences.slice(0, content.maximumSentence)
    }

    async function fetchKeywordsOfAllSentences(content){
        for(const sentence of content.sentences){
            sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)
        }
    }

    async function fetchWatsonAndReturnKeywords(sentence){
        return new Promise ((resolve, reject) =>{
            nlu.analyze(
            {
                text: sentence,
                features: {
                    keywords: {}
                }
                },(error, response) =>{
                    if (error) {
                        throw error
                    } 
                    const keywords = response.keywords.map((keyword)=>{
                        return keyword.text
                    })
                    resolve(keywords)
                    
                }
            );
        })
        
    }
}

module.exports = robot;