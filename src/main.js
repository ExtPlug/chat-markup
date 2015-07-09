define(function (require, exports, module) {

  const Plugin = require('extplug/Plugin')
  const Events = require('plug/core/Events')

  const MARKUP_TYPES = [ 'message', 'emote', 'mention' ]

  function Token(type, text) {
    this.type = type
    this.text = text
  }

  const ChatMarkup = Plugin.extend({
    name: 'Chat Markup',
    description: 'Applies some markdown/slack/reddit-like markup to ' +
                 'chat messages: _italic_, *bold*, ~strike~, `code`.',

    enable() {
      Events.on('chat:beforereceive', this.onMessage, this)
      this.Style({
        '.extplug-strike': { 'text-decoration': 'line-through' }
      })
    },

    disable() {
      Events.off('chat:beforereceive', this.onMessage)
    },

    onMessage(msg) {
      if (MARKUP_TYPES.indexOf(msg.type) !== -1) {
        msg.message = this.transform(msg.message)
      }
    },

    // we use a tokenizer instead of simple regexes, so we can easily
    // avoid applying markup to mid-word things, or mid-URL and
    // mid-username things in particular. E.g. "@_username_" will just
    // work, and "https://youtu.be/Yif_3Ryr_so" will too.
    // however it will still apply markup if it ends in the middle of a
    // word, like in "_italic_things"
    tokenize(text) {
      let chunk
      let i = 0
      let tokens = []
      // adds a token of type `type` if the current chunk starts with
      // a `delim`-delimited string
      const delimited = (delim, type) => {
        if (chunk[0] === delim && chunk[1] !== delim) {
          let end = chunk.indexOf(delim, 1)
          if (end !== -1) {
            tokens.push(new Token(type, chunk.slice(1, end)))
            i += end + 1
            return true
          }
        }
      }
      // eat spaces
      const space = () => {
        // .slice again because `i` changed
        let m = /^\s+/.exec(text.slice(i))
        if (m) {
          tokens.push(new Token('word', m[0]))
          i += m[0].length
        }
      }
      // tokenize text, just loop until it's done!
      while (chunk = text.slice(i)) {
        let found =
          delimited('_', 'em') ||
          delimited('*', 'strong') ||
          delimited('`', 'code') ||
          delimited('~', 'strike')
        if (!found) {
          let end = chunk.indexOf(' ', 1) + /* eat space */ 1
          if (end === 0) // no match, = -1 + 1
            end = chunk.length
          tokens.push(new Token('word', chunk.slice(0, end)))
          i += end
        }
        space()
      }
      return tokens
    },
    transform(text) {
      return this.tokenize(text).reduce((str, tok) => {
        return str + (
          tok.type === 'em'     ? `<em>${this.transform(tok.text)}</em>`
        : tok.type === 'strong' ? `<strong>${this.transform(tok.text)}</strong>`
        : tok.type === 'code'   ? `<code>${tok.text}</code>`
        : tok.type === 'strike' ? `<span class="extplug-strike">${this.transform(tok.text)}</span>`
        : tok.text
        )
      }, '')
    }
  })

  module.exports = ChatMarkup

})
