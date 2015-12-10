(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/jedwards/rlbp2/node_modules/marked/lib/marked.js":[function(require,module,exports){
(function (global){
/**
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 */

;(function() {

/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  nptable: noop,
  lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
  blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
  html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
  ('def', '\\n+(?=' + block.def.source + ')')
  ();

block.blockquote = replace(block.blockquote)
  ('def', block.def)
  ();

block._tag = '(?!(?:'
  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
  + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  ('tag', '<' + block._tag)
  ('def', block.def)
  ();

/**
 * Normal Block Grammar
 */

block.normal = merge({}, block);

/**
 * GFM Block Grammar
 */

block.gfm = merge({}, block.normal, {
  fences: /^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/,
  paragraph: /^/
});

block.gfm.paragraph = replace(block.paragraph)
  ('(?!', '(?!'
    + block.gfm.fences.source.replace('\\1', '\\2') + '|'
    + block.list.source.replace('\\1', '\\3') + '|')
  ();

/**
 * GFM + Tables Block Grammar
 */

block.tables = merge({}, block.gfm, {
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
});

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = options || marked.defaults;
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  return this.token(src, true);
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src, top, bq) {
  var src = src.replace(/^ +$/gm, '')
    , next
    , loose
    , cap
    , bull
    , b
    , item
    , space
    , i
    , l;

  while (src) {
    // newline
    if (cap = this.rules.newline.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[0].length > 1) {
        this.tokens.push({
          type: 'space'
        });
      }
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      cap = cap[0].replace(/^ {4}/gm, '');
      this.tokens.push({
        type: 'code',
        text: !this.options.pedantic
          ? cap.replace(/\n+$/, '')
          : cap
      });
      continue;
    }

    // fences (gfm)
    if (cap = this.rules.fences.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        lang: cap[2],
        text: cap[3]
      });
      continue;
    }

    // heading
    if (cap = this.rules.heading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[1].length,
        text: cap[2]
      });
      continue;
    }

    // table no leading pipe (gfm)
    if (top && (cap = this.rules.nptable.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i].split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // lheading
    if (cap = this.rules.lheading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[2] === '=' ? 1 : 2,
        text: cap[1]
      });
      continue;
    }

    // hr
    if (cap = this.rules.hr.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'hr'
      });
      continue;
    }

    // blockquote
    if (cap = this.rules.blockquote.exec(src)) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'blockquote_start'
      });

      cap = cap[0].replace(/^ *> ?/gm, '');

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top, true);

      this.tokens.push({
        type: 'blockquote_end'
      });

      continue;
    }

    // list
    if (cap = this.rules.list.exec(src)) {
      src = src.substring(cap[0].length);
      bull = cap[2];

      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);

      next = false;
      l = cap.length;
      i = 0;

      for (; i < l; i++) {
        item = cap[i];

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.) +/, '');

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = block.bullet.exec(cap[i + 1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src;
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item.charAt(item.length - 1) === '\n';
          if (!loose) loose = next;
        }

        this.tokens.push({
          type: loose
            ? 'loose_item_start'
            : 'list_item_start'
        });

        // Recurse.
        this.token(item, false, bq);

        this.tokens.push({
          type: 'list_item_end'
        });
      }

      this.tokens.push({
        type: 'list_end'
      });

      continue;
    }

    // html
    if (cap = this.rules.html.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style',
        text: cap[0]
      });
      continue;
    }

    // def
    if ((!bq && top) && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
      continue;
    }

    // table (gfm)
    if (top && (cap = this.rules.table.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'paragraph',
        text: cap[1].charAt(cap[1].length - 1) === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      });
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
};

inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

/**
 * Normal Inline Grammar
 */

inline.normal = merge({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = merge({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = merge({}, inline.normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = merge({}, inline.gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.gfm.text)('{2,}', '*')()
});

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = options || marked.defaults;
  this.links = links;
  this.rules = inline.normal;
  this.renderer = this.options.renderer || new Renderer;
  this.renderer.options = this.options;

  if (!this.links) {
    throw new
      Error('Tokens array requires a `links` property.');
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.output(src);
};

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function(src) {
  var out = ''
    , link
    , text
    , href
    , cap;

  while (src) {
    // escape
    if (cap = this.rules.escape.exec(src)) {
      src = src.substring(cap[0].length);
      out += cap[1];
      continue;
    }

    // autolink
    if (cap = this.rules.autolink.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[2] === '@') {
        text = cap[1].charAt(6) === ':'
          ? this.mangle(cap[1].substring(7))
          : this.mangle(cap[1]);
        href = this.mangle('mailto:') + text;
      } else {
        text = escape(cap[1]);
        href = text;
      }
      out += this.renderer.link(href, null, text);
      continue;
    }

    // url (gfm)
    if (!this.inLink && (cap = this.rules.url.exec(src))) {
      src = src.substring(cap[0].length);
      text = escape(cap[1]);
      href = text;
      out += this.renderer.link(href, null, text);
      continue;
    }

    // tag
    if (cap = this.rules.tag.exec(src)) {
      if (!this.inLink && /^<a /i.test(cap[0])) {
        this.inLink = true;
      } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
        this.inLink = false;
      }
      src = src.substring(cap[0].length);
      out += this.options.sanitize
        ? escape(cap[0])
        : cap[0];
      continue;
    }

    // link
    if (cap = this.rules.link.exec(src)) {
      src = src.substring(cap[0].length);
      this.inLink = true;
      out += this.outputLink(cap, {
        href: cap[2],
        title: cap[3]
      });
      this.inLink = false;
      continue;
    }

    // reflink, nolink
    if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
      src = src.substring(cap[0].length);
      link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
      link = this.links[link.toLowerCase()];
      if (!link || !link.href) {
        out += cap[0].charAt(0);
        src = cap[0].substring(1) + src;
        continue;
      }
      this.inLink = true;
      out += this.outputLink(cap, link);
      this.inLink = false;
      continue;
    }

    // strong
    if (cap = this.rules.strong.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.strong(this.output(cap[2] || cap[1]));
      continue;
    }

    // em
    if (cap = this.rules.em.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.em(this.output(cap[2] || cap[1]));
      continue;
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.codespan(escape(cap[2], true));
      continue;
    }

    // br
    if (cap = this.rules.br.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.br();
      continue;
    }

    // del (gfm)
    if (cap = this.rules.del.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.renderer.del(this.output(cap[1]));
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      src = src.substring(cap[0].length);
      out += escape(this.smartypants(cap[0]));
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  var href = escape(link.href)
    , title = link.title ? escape(link.title) : null;

  return cap[0].charAt(0) !== '!'
    ? this.renderer.link(href, title, this.output(cap[1]))
    : this.renderer.image(href, title, escape(cap[1]));
};

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
  if (!this.options.smartypants) return text;
  return text
    // em-dashes
    .replace(/--/g, '\u2014')
    // opening singles
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
    // closing singles & apostrophes
    .replace(/'/g, '\u2019')
    // opening doubles
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
    // closing doubles
    .replace(/"/g, '\u201d')
    // ellipses
    .replace(/\.{3}/g, '\u2026');
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  var out = ''
    , l = text.length
    , i = 0
    , ch;

  for (; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
};

/**
 * Renderer
 */

function Renderer(options) {
  this.options = options || {};
}

Renderer.prototype.code = function(code, lang, escaped) {
  if (this.options.highlight) {
    var out = this.options.highlight(code, lang);
    if (out != null && out !== code) {
      escaped = true;
      code = out;
    }
  }

  if (!lang) {
    return '<pre><code>'
      + (escaped ? code : escape(code, true))
      + '\n</code></pre>';
  }

  return '<pre><code class="'
    + this.options.langPrefix
    + escape(lang, true)
    + '">'
    + (escaped ? code : escape(code, true))
    + '\n</code></pre>\n';
};

Renderer.prototype.blockquote = function(quote) {
  return '<blockquote>\n' + quote + '</blockquote>\n';
};

Renderer.prototype.html = function(html) {
  return html;
};

Renderer.prototype.heading = function(text, level, raw) {
  return '<h'
    + level
    + ' id="'
    + this.options.headerPrefix
    + raw.toLowerCase().replace(/[^\w]+/g, '-')
    + '">'
    + text
    + '</h'
    + level
    + '>\n';
};

Renderer.prototype.hr = function() {
  return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
};

Renderer.prototype.list = function(body, ordered) {
  var type = ordered ? 'ol' : 'ul';
  return '<' + type + '>\n' + body + '</' + type + '>\n';
};

Renderer.prototype.listitem = function(text) {
  return '<li>' + text + '</li>\n';
};

Renderer.prototype.paragraph = function(text) {
  return '<p>' + text + '</p>\n';
};

Renderer.prototype.table = function(header, body) {
  return '<table>\n'
    + '<thead>\n'
    + header
    + '</thead>\n'
    + '<tbody>\n'
    + body
    + '</tbody>\n'
    + '</table>\n';
};

Renderer.prototype.tablerow = function(content) {
  return '<tr>\n' + content + '</tr>\n';
};

Renderer.prototype.tablecell = function(content, flags) {
  var type = flags.header ? 'th' : 'td';
  var tag = flags.align
    ? '<' + type + ' style="text-align:' + flags.align + '">'
    : '<' + type + '>';
  return tag + content + '</' + type + '>\n';
};

// span level renderer
Renderer.prototype.strong = function(text) {
  return '<strong>' + text + '</strong>';
};

Renderer.prototype.em = function(text) {
  return '<em>' + text + '</em>';
};

Renderer.prototype.codespan = function(text) {
  return '<code>' + text + '</code>';
};

Renderer.prototype.br = function() {
  return this.options.xhtml ? '<br/>' : '<br>';
};

Renderer.prototype.del = function(text) {
  return '<del>' + text + '</del>';
};

Renderer.prototype.link = function(href, title, text) {
  if (this.options.sanitize) {
    try {
      var prot = decodeURIComponent(unescape(href))
        .replace(/[^\w:]/g, '')
        .toLowerCase();
    } catch (e) {
      return '';
    }
    if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
      return '';
    }
  }
  var out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += '>' + text + '</a>';
  return out;
};

Renderer.prototype.image = function(href, title, text) {
  var out = '<img src="' + href + '" alt="' + text + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += this.options.xhtml ? '/>' : '>';
  return out;
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = options || marked.defaults;
  this.options.renderer = this.options.renderer || new Renderer;
  this.renderer = this.options.renderer;
  this.renderer.options = this.options;
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options, renderer) {
  var parser = new Parser(options, renderer);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options, this.renderer);
  this.tokens = src.reverse();

  var out = '';
  while (this.next()) {
    out += this.tok();
  }

  return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length - 1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function() {
  var body = this.token.text;

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text;
  }

  return this.inline.output(body);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function() {
  switch (this.token.type) {
    case 'space': {
      return '';
    }
    case 'hr': {
      return this.renderer.hr();
    }
    case 'heading': {
      return this.renderer.heading(
        this.inline.output(this.token.text),
        this.token.depth,
        this.token.text);
    }
    case 'code': {
      return this.renderer.code(this.token.text,
        this.token.lang,
        this.token.escaped);
    }
    case 'table': {
      var header = ''
        , body = ''
        , i
        , row
        , cell
        , flags
        , j;

      // header
      cell = '';
      for (i = 0; i < this.token.header.length; i++) {
        flags = { header: true, align: this.token.align[i] };
        cell += this.renderer.tablecell(
          this.inline.output(this.token.header[i]),
          { header: true, align: this.token.align[i] }
        );
      }
      header += this.renderer.tablerow(cell);

      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i];

        cell = '';
        for (j = 0; j < row.length; j++) {
          cell += this.renderer.tablecell(
            this.inline.output(row[j]),
            { header: false, align: this.token.align[j] }
          );
        }

        body += this.renderer.tablerow(cell);
      }
      return this.renderer.table(header, body);
    }
    case 'blockquote_start': {
      var body = '';

      while (this.next().type !== 'blockquote_end') {
        body += this.tok();
      }

      return this.renderer.blockquote(body);
    }
    case 'list_start': {
      var body = ''
        , ordered = this.token.ordered;

      while (this.next().type !== 'list_end') {
        body += this.tok();
      }

      return this.renderer.list(body, ordered);
    }
    case 'list_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text'
          ? this.parseText()
          : this.tok();
      }

      return this.renderer.listitem(body);
    }
    case 'loose_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return this.renderer.listitem(body);
    }
    case 'html': {
      var html = !this.token.pre && !this.options.pedantic
        ? this.inline.output(this.token.text)
        : this.token.text;
      return this.renderer.html(html);
    }
    case 'paragraph': {
      return this.renderer.paragraph(this.inline.output(this.token.text));
    }
    case 'text': {
      return this.renderer.paragraph(this.parseText());
    }
  }
};

/**
 * Helpers
 */

function escape(html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function unescape(html) {
  return html.replace(/&([#\w]+);/g, function(_, n) {
    n = n.toLowerCase();
    if (n === 'colon') return ':';
    if (n.charAt(0) === '#') {
      return n.charAt(1) === 'x'
        ? String.fromCharCode(parseInt(n.substring(2), 16))
        : String.fromCharCode(+n.substring(1));
    }
    return '';
  });
}

function replace(regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self(name, val) {
    if (!name) return new RegExp(regex, opt);
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self;
  };
}

function noop() {}
noop.exec = noop;

function merge(obj) {
  var i = 1
    , target
    , key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}


/**
 * Marked
 */

function marked(src, opt, callback) {
  if (callback || typeof opt === 'function') {
    if (!callback) {
      callback = opt;
      opt = null;
    }

    opt = merge({}, marked.defaults, opt || {});

    var highlight = opt.highlight
      , tokens
      , pending
      , i = 0;

    try {
      tokens = Lexer.lex(src, opt)
    } catch (e) {
      return callback(e);
    }

    pending = tokens.length;

    var done = function(err) {
      if (err) {
        opt.highlight = highlight;
        return callback(err);
      }

      var out;

      try {
        out = Parser.parse(tokens, opt);
      } catch (e) {
        err = e;
      }

      opt.highlight = highlight;

      return err
        ? callback(err)
        : callback(null, out);
    };

    if (!highlight || highlight.length < 3) {
      return done();
    }

    delete opt.highlight;

    if (!pending) return done();

    for (; i < tokens.length; i++) {
      (function(token) {
        if (token.type !== 'code') {
          return --pending || done();
        }
        return highlight(token.text, token.lang, function(err, code) {
          if (err) return done(err);
          if (code == null || code === token.text) {
            return --pending || done();
          }
          token.text = code;
          token.escaped = true;
          --pending || done();
        });
      })(tokens[i]);
    }

    return;
  }
  try {
    if (opt) opt = merge({}, marked.defaults, opt);
    return Parser.parse(Lexer.lex(src, opt), opt);
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/chjj/marked.';
    if ((opt || marked.defaults).silent) {
      return '<p>An error occured:</p><pre>'
        + escape(e.message + '', true)
        + '</pre>';
    }
    throw e;
  }
}

/**
 * Options
 */

marked.options =
marked.setOptions = function(opt) {
  merge(marked.defaults, opt);
  return marked;
};

marked.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-',
  smartypants: false,
  headerPrefix: '',
  renderer: new Renderer,
  xhtml: false
};

/**
 * Expose
 */

marked.Parser = Parser;
marked.parser = Parser.parse;

marked.Renderer = Renderer;

marked.Lexer = Lexer;
marked.lexer = Lexer.lex;

marked.InlineLexer = InlineLexer;
marked.inlineLexer = InlineLexer.output;

marked.parse = marked;

if (typeof module !== 'undefined' && typeof exports === 'object') {
  module.exports = marked;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return marked; });
} else {
  this.marked = marked;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],"/home/jedwards/rlbp2/src/BarContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3Bar = require('./d3Bar.js');

var BarContainer = React.createClass({displayName: "BarContainer",
  getDefaultProps: function() {
    return {
      width: 800,
      height: 500,
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3Bar.create(el, {
      width: this.props.width,
      height: this.props.height,
      csv: this.props.csv
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3Bar.update(el, this.props);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = BarContainer;

},{"./d3Bar.js":"/home/jedwards/rlbp2/src/d3Bar.js"}],"/home/jedwards/rlbp2/src/CanvasFeatContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3CanvasFeat = require('./d3CanvasFeat.js');

var CanvasFeatContainer = React.createClass({displayName: "CanvasFeatContainer",
    loadJSONFromServer: function () {
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            cache: false,
            success: function(data) {
                this.setState({data: data});
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getInitialState: function () {
        return {data: [],
                location: {x: 120, y: 100, w: 80, h: 80},
        };
    },
  getDefaultProps: function() {
    return {
      move: true,
      title: "",
      width: 960,
      height: 600,
      scale: 1.0,
      pixelated: true,
      yblock: 1,
      xblock: 1,
      grid: false,
      search: {x: 320, y: 160, w: 240, h: 240},
      feature: {x: 600, y: 0, w: 500, h: 500},
    };
  },

  componentDidMount: function() {
    this.loadJSONFromServer();
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasFeat.create(el, this.props, this.state);

    if(this.props.move == true) {
      // this.interval = setInterval(this._step, 100);
    }
  },

  _step: function() {
    var next_location = this.state.location;

    next_location.x += 1;
    if(next_location.x + next_location.w > 299){
      next_location.x = 0;
      next_location.y += 1;
    }
    if(next_location.y + next_location.h > 219){
      next_location.y = 0;
    }
  
    this.setState({location: next_location});
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasFeat.update(el, this.props, this.state);

  },

  // render: function() {
  //   return (
  //     <div className="container">
  //       <div className="row">
  //         <div className="col-xs-8">
  //           <h3>{this.props.title}</h3>
  //           <hr />
  //           <div ref="d3"></div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // },
  render: function() {
    return (
      React.createElement("div", null, 
          React.createElement("h3", null, this.props.title), 
          React.createElement("hr", null), 
          React.createElement("div", {ref: "d3"})
      )
    );
  },
});

module.exports = CanvasFeatContainer;

},{"./d3CanvasFeat.js":"/home/jedwards/rlbp2/src/d3CanvasFeat.js"}],"/home/jedwards/rlbp2/src/CanvasHeatContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3CanvasHeat = require('./d3CanvasHeat.js');

var CanvasHeatContainer = React.createClass({displayName: "CanvasHeatContainer",
    loadJSONFromServer: function () {
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            cache: false,
            success: function(data) {
                this.setState({data: data});
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getInitialState: function () {
        return {data: []};
    },
  getDefaultProps: function() {
    return {
      width: 480,
      height: 360,
      scale: 2.14,
      pixelated: true,
      yblock: 1,
      xblock: 1,
      grid: false,
    };
  },

  componentDidMount: function() {
    this.loadJSONFromServer();
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasHeat.create(el, this.props, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasHeat.update(el, this.props, this.state);
  },

  // render: function() {
  //   return (
  //     <div className="container">
  //       <div className="row">
  //         <div className="col-xs-8">
  //           <h3>{this.props.title}</h3>
  //           <hr />
  //           <div ref="d3"></div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // },
  render: function() {
    return (
      React.createElement("div", null, 
          React.createElement("h3", null, this.props.title), 
          React.createElement("hr", null), 
          React.createElement("div", {ref: "d3"})
      )
    );
  },
});

module.exports = CanvasHeatContainer;

},{"./d3CanvasHeat.js":"/home/jedwards/rlbp2/src/d3CanvasHeat.js"}],"/home/jedwards/rlbp2/src/FeatureContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3Feature = require('./d3Feature.js');

var FeatureContainer = React.createClass({displayName: "FeatureContainer",
  getDefaultProps: function() {
    return {
      width: 960,
      height: 200
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3Feature.create(el, {
      width: this.props.width,
      height: this.props.height
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3Feature.update(el, this.state);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = FeatureContainer;

},{"./d3Feature.js":"/home/jedwards/rlbp2/src/d3Feature.js"}],"/home/jedwards/rlbp2/src/GroupBarContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3GroupBar = require('./d3GroupBar.js');

var GroupBarContainer = React.createClass({displayName: "GroupBarContainer",
  getDefaultProps: function() {
    return {
      width: 960,
      height: 300,
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3GroupBar.create(el, {
      width: this.props.width,
      height: this.props.height,
      csv: this.props.csv
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3GroupBar.update(el, this.props);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = GroupBarContainer;

},{"./d3GroupBar.js":"/home/jedwards/rlbp2/src/d3GroupBar.js"}],"/home/jedwards/rlbp2/src/HBarContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3HBar = require('./d3HBar.js');

var HBarContainer = React.createClass({displayName: "HBarContainer",
  getDefaultProps: function() {
    return {
      width: 800,
      height: 500,
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3HBar.create(el, {
      width: this.props.width,
      height: this.props.height,
      csv: this.props.csv
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3HBar.update(el, this.props);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = HBarContainer;

},{"./d3HBar.js":"/home/jedwards/rlbp2/src/d3HBar.js"}],"/home/jedwards/rlbp2/src/HeatContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3Heat = require('./d3Heat.js');

var HeatContainer = React.createClass({displayName: "HeatContainer",
  getDefaultProps: function() {
    return {
      width: 800,
      height: 500,
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3Heat.create(el, {
      width: this.props.width,
      height: this.props.height,
      csv: this.props.csv
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3Heat.update(el, this.props);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = HeatContainer;

},{"./d3Heat.js":"/home/jedwards/rlbp2/src/d3Heat.js"}],"/home/jedwards/rlbp2/src/ImageContainer.js":[function(require,module,exports){
// var React = require('react');

var divStyle = {
    maxWidth: "100%",
    height: "auto"
};

var ImageContainer = React.createClass({displayName: "ImageContainer",
    render: function() {
        return (
            React.createElement("div", {className: "container imageContainer"}, 
                React.createElement("div", {className: "row"}, 
                    React.createElement("div", {className: "col-xs-8"}, 
                        React.createElement("h3", null, this.props.title)
                    ), 
                    React.createElement("div", {className: "col-xs-8"}, 
                        React.createElement("img", {style: divStyle, src: this.props.url})
                    )
                )
            )
        );
    }
});

module.exports = ImageContainer;

},{}],"/home/jedwards/rlbp2/src/LettersContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3Letters = require('./d3Letters.js');

var LettersContainer = React.createClass({displayName: "LettersContainer",
  getDefaultProps: function() {
    return {
      width: 960,
      height: 500
    };
  },

  getInitialState: function() {
    return {
      data: this._alphabet
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3Letters.create(el, {
      width: this.props.width,
      height: this.props.height
    }, this.state);

    this.interval = setInterval(this._shuffle, 5000);
  },

  _alphabet : "abcdefghijklmnopqrstuvwxyz".split(""),

  _shuffle: function() {
    this.setState({data: d3.shuffle(this._alphabet)
                  .slice(0, Math.floor(Math.random() * 25 + 1))
                  .sort()});
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3Letters.update(el, this.state);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = LettersContainer;

},{"./d3Letters.js":"/home/jedwards/rlbp2/src/d3Letters.js"}],"/home/jedwards/rlbp2/src/LineContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3Line = require('./d3Line.js');

var LineContainer = React.createClass({displayName: "LineContainer",
  getDefaultProps: function() {
    return {
      width: 800,
      height: 500,
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3Line.create(el, {
      width: this.props.width,
      height: this.props.height,
      csv: this.props.csv
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3Line.update(el, this.props);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = LineContainer;

},{"./d3Line.js":"/home/jedwards/rlbp2/src/d3Line.js"}],"/home/jedwards/rlbp2/src/MXPContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3MXP = require('./d3MXP.js');

var FeatureContainer = React.createClass({displayName: "FeatureContainer",
  getDefaultProps: function() {
    return {
      width: 960,
      height: 400
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3MXP.create(el, {
      width: this.props.width,
      height: this.props.height
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3MXP.update(el, this.state);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = FeatureContainer;

},{"./d3MXP.js":"/home/jedwards/rlbp2/src/d3MXP.js"}],"/home/jedwards/rlbp2/src/MarkdownContainer.js":[function(require,module,exports){
// var React = require('react');
var MarkdownForm = require('./MarkdownForm.js');
var MarkdownList = require('./MarkdownList.js');

var MarkdownContainer = React.createClass({displayName: "MarkdownContainer",
    loadJSONFromServer: function () {
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            cache: false,
            success: function(data) {
                this.setState({data: data});
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },
    handleMarkdownSubmit: function(markdown) {
        var markdowns = this.state.data;
        var newMarkdowns = markdowns.concat([markdown]);
        this.setState({data: newMarkdowns});
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            type: 'POST',
            data: markdown,
            success: function(data) {
                this.setState({data: data});
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    }, 
    getInitialState: function () {
        return {data: []};
    },
    getDefaultProps: function () {
        return {pollInterval: null};
    },
    componentDidMount: function() {
        this.loadJSONFromServer();
        if (this.props.pollInterval) {
            setInterval(this.loadJSONFromServer, this.props.pollInterval);
        }
    },
    render: function() {
        return (
            React.createElement("div", {className: "container"}, 
                React.createElement("div", {className: "markdownBox"}, 
                    React.createElement("h3", null, this.props.title), 
                    React.createElement("hr", null), 
                    React.createElement("div", {className: "row"}, 
                        React.createElement("div", {className: "col-xs-8"}, 
                            React.createElement(MarkdownList, {data: this.state.data})
                        ), 
                        React.createElement("div", {className: "col-xs-4"}, 
                            React.createElement(MarkdownForm, {title: this.props.title, onMarkdownSubmit: this.handleMarkdownSubmit})
                        )
                    )
                )
            )
        );
    }
});

module.exports = MarkdownContainer;

},{"./MarkdownForm.js":"/home/jedwards/rlbp2/src/MarkdownForm.js","./MarkdownList.js":"/home/jedwards/rlbp2/src/MarkdownList.js"}],"/home/jedwards/rlbp2/src/MarkdownFigure.js":[function(require,module,exports){
// var React = require('react');
// var marked = require('marked');
require('marked');
require('./d3Table.less');

var MarkdownFigure = React.createClass({displayName: "MarkdownFigure",
    render: function() {
        marked.setOptions({
            highlight: function (code) {
                // return require('highlight.js').highlightAuto(code).value;
                return hljs.highlightAuto(code).value;
            }
        });
        var rawMarkup = marked(this.props.children.toString(), {sanitize: true, breaks: true});
        return (
            React.createElement("div", {className: "row"}, 
                React.createElement("div", {className: "col-xs-12"}, 
                    React.createElement("div", {className: "markdown"}, 
                        React.createElement("h7", {className: "markdownTitle"}, 
                            this.props.title
                        ), 
                        React.createElement("span", {dangerouslySetInnerHTML: {__html: rawMarkup}})
                    )
                )
            )
        );
    }
});

module.exports = MarkdownFigure;

},{"./d3Table.less":"/home/jedwards/rlbp2/src/d3Table.less","marked":"/home/jedwards/rlbp2/node_modules/marked/lib/marked.js"}],"/home/jedwards/rlbp2/src/MarkdownForm.js":[function(require,module,exports){
// var React = require('react');

var MarkdownForm = React.createClass({displayName: "MarkdownForm",
    handleSubmit: function(e) {
        e.preventDefault();
        var title = React.findDOMNode(this.refs.title).value.trim();
        var text = React.findDOMNode(this.refs.text).value.trim();
        if (!text || !title) {
            return;
        }
        this.props.onMarkdownSubmit({title: title, text: text});
        React.findDOMNode(this.refs.title).value = '';
        React.findDOMNode(this.refs.text).value = '';
        return;
    },
    render: function() {
        var divStyle = {width: '100%'};
        return (
            React.createElement("div", null, 
                React.createElement("h7", null, 
                    "Add ", this.props.title.toLowerCase()
                ), 
                React.createElement("form", {className: "markdownForm", onSubmit: this.handleSubmit}, 
                    React.createElement("div", {className: "row"}, 
                        React.createElement("div", {className: "col-xs-12"}, 
                            React.createElement("input", {style: divStyle, type: "text", ref: "title", placeholder: "   Title"})
                        )
                    ), 
                    React.createElement("div", {className: "row"}, 
                        React.createElement("div", {className: "col-xs-12"}, 
                            React.createElement("textarea", {style: divStyle, type: "text", ref: "text", placeholder: "Markdown text..."})
                        )
                    ), 
                    React.createElement("div", {className: "row"}, 
                        React.createElement("div", {className: "col-xs-12"}, 
                            React.createElement("button", {className: "btn btn-primary", type: "submit"}, "Post")
                        )
                    )
                )
            )
        );
    }
});

module.exports = MarkdownForm;

},{}],"/home/jedwards/rlbp2/src/MarkdownList.js":[function(require,module,exports){
// var React = require('react');
var MarkdownFigure = require('./MarkdownFigure.js');

var MarkdownList = React.createClass({displayName: "MarkdownList",
    render: function() {
        var markdownNodes = this.props.data.map(function (markdown) {
            return (
                React.createElement(MarkdownFigure, {title: markdown.title}, 
                    markdown.text
                )
            );
        });
        return (
            React.createElement("div", {className: "markdownList"}, 
                markdownNodes
            )
        );
    }
});

module.exports = MarkdownList;

},{"./MarkdownFigure.js":"/home/jedwards/rlbp2/src/MarkdownFigure.js"}],"/home/jedwards/rlbp2/src/StackedBarContainer.js":[function(require,module,exports){
// var React = require('react');
// var d3 = require('d3');
var d3StackedBar = require('./d3StackedBar.js');

var StackedBarContainer = React.createClass({displayName: "StackedBarContainer",
  getDefaultProps: function() {
    return {
      width: 960,
      height: 500,
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3StackedBar.create(el, {
      width: this.props.width,
      height: this.props.height,
      csv: this.props.csv
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3StackedBar.update(el, this.props);
  },

  render: function() {
    return (
      React.createElement("div", {className: "container"}, 
        React.createElement("div", {className: "row"}, 
          React.createElement("div", {className: "col-xs-8"}, 
            React.createElement("h3", null, this.props.title), 
            React.createElement("hr", null), 
            React.createElement("div", {ref: "d3"})
          )
        )
      )
    );
  },
});

module.exports = StackedBarContainer;

},{"./d3StackedBar.js":"/home/jedwards/rlbp2/src/d3StackedBar.js"}],"/home/jedwards/rlbp2/src/app.js":[function(require,module,exports){
// var React = require('react');


var CanvasFeatContainer = require('./CanvasFeatContainer.js');
var FeatureContainer = require('./FeatureContainer.js');
var ImageContainer = require('./ImageContainer.js');
var CanvasHeatContainer = require('./CanvasHeatContainer.js');
var HeatContainer = require('./HeatContainer.js');
var LineContainer = require('./LineContainer.js');
var StackedBarContainer = require('./StackedBarContainer.js');
var GroupBarContainer = require('./GroupBarContainer.js');
var HBarContainer = require('./HBarContainer.js');
var BarContainer = require('./BarContainer.js');
var LettersContainer = require('./LettersContainer.js');
var MarkdownContainer = require('./MarkdownContainer.js');
var MXPContainer = require('./MXPContainer.js');

React.render(
    React.createElement("div", null, 
            /*
        <div className='container'>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasFeatContainer url='/lenna_raw.json' percent='true' move='true' />
                </div>
            </div>
        </div>
            */
            /*
            <div className='row'>
                <div className='col-xs-4'>
                    <MXPContainer/>
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_stage.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={4}  url='/lenna_stage.json' />
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1000} url='/lenna_stage.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={16} xblock={16} url='/lenna_stage.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} legend={true} yblock={1} xblock={32} url='/lenna_stage.json' />
                </div>
            </div>
        </div>
        <FeatureContainer title='Feature'/>
        <div className='container'>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_feat.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={4}  url='/lenna_feat.json' />
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1000} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={16} xblock={16} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} legend={true} yblock={1} xblock={32} url='/lenna_feat.json' />
                </div>
            </div>
        </div>
        <div className='container'>
            <div className='row'>
                <div className='col-xs-3'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-3'>
                <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_feat.json' />
                </div>
                <div className='col-xs-3'>
                <CanvasHeatContainer grey={true} yblock={4} xblock={4}  url='/lenna_feat.json' />
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} yblock={1} xblock={1} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} yblock={1} xblock={1000} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} legend={true} yblock={1} xblock={64} url='/lenna_feat.json' />
                </div>
            </div>
        </div>

        <div className='container'>
            <div className='row'>
                <div className='col-xs-4'>
                    <h3>
                        LBP Cell Sizes
                    </h3>
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer percent={true} grid={true} axis={true} url='/test.json'/>
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer percent={true} grid={true} axis={true} url='/test_r.json'/>
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer percent={true} grid={true} axis={true} url='/test_r2.json' legend={true} />
                </div>
            </div>
        </div>
        <ImageContainer title='Filtering Faces' url='/faces.png' />
        <ImageContainer title='Cascade Results' url='/cascades.jpg' />
        <HeatContainer title='Heat' csv='heatmap.csv' />
        */
        React.createElement(GroupBarContainer, {title: "Performance (ms)", csv: "/zperformance4.csv"})
        /*
        <GroupBarContainer title='Performance / Area' csv='/zarea.csv' />
        <StackedBarContainer title='Stacked Bar Chart' csv='population.csv' />
        <LineContainer title='Simple Line Chart' csv='line.csv' />
        <BarContainer title='Simple Bar Chart' csv='letters.csv' />
        <HBarContainer title='Simple HBar Chart' csv='letters.csv' />
        <LettersContainer title='General update pattern' width='100%' height='0'/>
        <MarkdownContainer title='Code' url='data/code.json'/>
        <MarkdownContainer title='Tables' url='data/tables.json'/>
        */
    ),
    document.body
);

// React.render(
//     <div>
//         <div className='container'>
//             <div className='row'>
//                 <div className='col-xs-12'>
//                     <h1>
//                         Cust
//                         <span className="fui-heart"></span>
//                         m Cards by Rei
//                     </h1>
//                 </div>
//             </div>
//         </div>
//         <MarkdownContainer title="Reviews" url='data/cards.json'/>
//         <LineContainer title='Sales' csv='line2.csv' />
//     </div>,
//     document.body
// );

},{"./BarContainer.js":"/home/jedwards/rlbp2/src/BarContainer.js","./CanvasFeatContainer.js":"/home/jedwards/rlbp2/src/CanvasFeatContainer.js","./CanvasHeatContainer.js":"/home/jedwards/rlbp2/src/CanvasHeatContainer.js","./FeatureContainer.js":"/home/jedwards/rlbp2/src/FeatureContainer.js","./GroupBarContainer.js":"/home/jedwards/rlbp2/src/GroupBarContainer.js","./HBarContainer.js":"/home/jedwards/rlbp2/src/HBarContainer.js","./HeatContainer.js":"/home/jedwards/rlbp2/src/HeatContainer.js","./ImageContainer.js":"/home/jedwards/rlbp2/src/ImageContainer.js","./LettersContainer.js":"/home/jedwards/rlbp2/src/LettersContainer.js","./LineContainer.js":"/home/jedwards/rlbp2/src/LineContainer.js","./MXPContainer.js":"/home/jedwards/rlbp2/src/MXPContainer.js","./MarkdownContainer.js":"/home/jedwards/rlbp2/src/MarkdownContainer.js","./StackedBarContainer.js":"/home/jedwards/rlbp2/src/StackedBarContainer.js"}],"/home/jedwards/rlbp2/src/d3Axis.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = "text.axis,.axis text{font:18px sans-serif !important}.axis path,.axis line{fill:none;stroke:#000;shape-rendering:crispEdges}.x.axis path{display:none}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3Bar.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3Bar.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 30, bottom: 30, left: 40}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {

  d3.select(el).append('svg')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left')
              .ticks(10, '%');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);
  var x = d3.scale.ordinal()
          .rangeRoundBands([0, width], .1);

  return {x: x, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  d3.csv(props.csv, type, function (error, data) {

    scales.x.domain(data.map(function(d) {return d.name; }));
    scales.y.domain([0, d3.max(data, function(d) { return d.value; })]);
    var chart = d3.select(el).select('.chart');

    chart.append('g')
      .attr('class', 'x axis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x);

    chart.append("g")
      .attr("class", "y axis")
      .call(axis.y)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Frequency');


    // data join (enter only)
    var bar = chart.selectAll('.bar')
           .data(data)
           .enter().append('g')
           .attr('class', 'bar')
           .attr('transform', function(d, i) { return "translate(" + scales.x(d.name) + ", 0)"; });

    bar.append('rect')
        .attr("y", function(d) { return scales.y(d.value); })
        .attr("height", function(d) { return height - scales.y(d.value); })
        .attr("width", scales.x.rangeBand() - 1);

    bar.append('text')
        .attr("x", scales.x.rangeBand() / 2)
        .attr("y", function(d) { return scales.y(d.value) + 3; })
        .attr("dy", ".75em")
        .text(function(d) {return Math.round(d.value * 1000)/10.0;});
  });

  function type(d) {
    d.value = +d.value; //coerce to number
    return d;
  }

  function add_percent(d, n) {
    percent = +(d.split("%")[0])
    newPercent = percent + n
    return "" + newPercent + "%";
  }
};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less","./d3Bar.less":"/home/jedwards/rlbp2/src/d3Bar.less"}],"/home/jedwards/rlbp2/src/d3Bar.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".bar rect{fill:steelblue}.bar:hover rect{fill:orange}.bar text{visibility:hidden !important;fill:white !important;font:10px sans-serif !important;text-anchor:middle !important}.bar:hover text{visibility:visible !important}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3CanvasFeat.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3Pos.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 90, bottom: 30, left: 50}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns._img = new Image(),
ns._imgReady = false,

ns.create = function(el, props, state) {
  console.log(ns._imgReady);
  ns._img.onload = function() {
    ns._imgReady = true;
    console.log(ns._imgReady);
  }
  ns._img.src = 'lenna.png';

  container = d3.select(el).append('div')
    .attr('class', 'rel')
    .style('width', props.width + "px")
    .style('height', props.height + "px")


  // container.append('div')
  // .attr('class', 'abs')
  //   .style('width', this._width(props) + "px")
  //   .style('height', this._height(props) + "px")
  // .style('left', this._margin.left + "px")
  // .style('top', this._margin.top + "px")
  //   .append('canvas')
  //   .style('width', this._width(props)/2 + "px")
  //   .style('height', this._height(props) + "px")
  //   .attr('class', 'image abs');

  factor = 1.33;
  img_width = 299;
  img_height = 219;

    dots = container.append('div')
    .attr('class', 'abs')
      .style('width', this._width(props) + "px")
      .style('height', this._height(props) + "px")
      .style('left', this._margin.left + "px")
      // .style('top', this._margin.top + img_height_offset + "px")
      .style('top',  img_height_offset + "px")
    .append('svg')
      .attr('height', this._height(props) + "px")
      .attr('class', 'abs');

     dots.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.70em')
      .attr('dx', '-.2em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('...');

     dots.append('text')
      .attr('x', 0)
      .attr('y', this._height(props) - 33)
      .attr('dy', '.81em')
      .attr('dx', '-.2em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('...');

  for (var i = 0; i < 3; i++ ) {
    var img_height_offset = 0;
    for (var k = 0; k < i; k++ ) {
      img_height_offset += img_height/Math.pow(factor, k);
    }


    container.append('div')
    .attr('class', 'abs')
      .style('width', this._width(props) + "px")
      .style('height', this._height(props) + "px")
    .style('left', this._margin.left + "px")
    .style('top', this._margin.top + img_height_offset + "px")
      .append('img')
      .attr('src', "lenna.png")
      .style('width', img_width/Math.pow(factor,i) + "px")
      .style('height', img_height/Math.pow(factor,i) + "px")
      .attr('class', 'abs');
  }

 container.append('svg')
    .attr('class', 'abs')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

search_container =  container.append('div')
  .attr('class', 'abs')
    .style('width', props.search.w + "px")
    .style('height', props.search.h + "px")
  .style('left', this._margin.left + props.search.x + "px")
  .style('top', this._margin.top + props.search.y + "px");

search_container.append('canvas')
    .style('width', props.search.w + "px")
    .style('height', props.search.h + "px")
    .attr('class', 'heatmap abs')
    .classed('pixelated', props.pixelated);

search_container.append('svg')
    .style('width', props.search.w + "px")
    .style('height', props.search.h + "px")
    .attr('class', 'search abs')
    .classed('pixelated', props.pixelated);

feature_y_offset = 140;

stage_container =  container.append('div')
  .attr('class', 'abs')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
  .style('left', this._margin.left + props.feature.x + "px")
  .style('top', this._margin.top + props.feature.y  + "px");

stage_container.append('svg')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
    .attr('class', 'stage abs')
    .classed('pixelated', props.pixelated);

feature_container =  container.append('div')
  .attr('class', 'abs')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
  .style('left', this._margin.left + props.feature.x + "px")
  .style('top', this._margin.top + props.feature.y  + feature_y_offset + "px");

feature_container.append('svg')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
    .attr('class', 'feature abs')
    .classed('pixelated', props.pixelated);

  this.update(el, props, state);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .tickValues([1,2,3,4,5,6])
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .tickValues([1,2,3,4,5,6])
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props)/3;
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);
  var x = d3.scale.linear()
          .range([0, width]);

  return {x: x, y: y};
}

ns.update = function(el, props, state) {
  var margin = this._margin;
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  var data = null
  if (state.data && state.data.length > 0 && Array.isArray(state.data[0])) {
    data = state.data;
  } else {
    for (var i in state.data) {
      if (state.data[i].scale == props.scale) {
        data = state.data[i].data;
      }
    }
  }


  if (data) {

    if (props.percent) {
      var sum = d3.sum(data, function(d) { return d3.sum(d); });
      data = data.map(function(d) { return d.map(function(d) {return 1.0 * d / sum;}); });
      data = data.reverse();
    }

    var dx = data[0].length;
    var dy = data.length;

    var start = 1;
    scales.x.domain([start, dx+start]);
    scales.y.domain([start, dy+start]);

    var colorDomain = [0, d3.max(data, function(d) { return d3.max(d);})];
    if (props.percent) {
      colorDomain = [0, 0.05, 1];
      colorRange = ['rgb(255,255,255)','rgb(255,255,217)','rgb(237,248,177)','rgb(199,233,180)','rgb(127,205,187)','rgb(65,182,196)','rgb(29,145,192)','rgb(34,94,168)','rgb(37,52,148)','rgb(8,29,88)'];
      colorRange = ['rgb(255,255,255)', 'rgb(127,205,187)', 'rgb(8,29,88)'];
    }
    var color;
    if (props.grey) {
      color = d3.scale
                  // .pow().exponent(2)
                  .linear()
                  // .domain(colorDomain)
                  // .range(["#000000","#ffffff"].reverse());
                  .domain([1, 255])
                  .range(["#000000","#ffffff"]);
    } else {
      color = d3.scale.linear()
                  .domain(colorDomain)
                  .range(colorRange);
    }

    var chart = d3.select(el).select('.chart');
    // chart.append('text').attr('class', 'axis').text(function() { var a = []; for(i=0; i<20; i++) {a.push('0, ');} return 'LUT= [ ' + a.join('').slice(0,-2) +' ]';});

    var window = chart.selectAll('.window')
         .data([state.location]);
    
    window_enter = window.enter().append('g')
      .attr('class', 'window')

    window_enter.append('rect');
    window_enter.append('line')
       .attr('class', 'line0');
    window_enter.append('line')
       .attr('class', 'line1');
    window_enter.append('line')
       .attr('class', 'line2');
    window_enter.append('line')
       .attr('class', 'line3');
    window_enter.append('polygon')
       .attr('class', 'polygon0')
    window_enter.append('polygon')
       .attr('class', 'polygon1')
    window_enter.append('polygon')
       .attr('class', 'polygon2')
    window_enter.append('polygon')
       .attr('class', 'polygon3');

    window.select('rect')
      .attr('x', function(d) {return d.x})
      .attr('y', function(d) {return d.y})
      .attr('width', function(d) {return d.w})
      .attr('height', function(d) {return d.h})
      .attr('fill', 'white')
      .attr('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon0')
      .attr('points', function(d) {
        var x0 = d.x;
        var y0 = d.y + d.h;
        var x1 = props.search.x;
        var y1 = props.search.y + props.search.h;
        var x2 = props.search.x + props.search.w;
        var y2 = props.search.y + props.search.h;
        var x3 = d.x + d.w;
        var y3 = d.y + d.h;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon1')
      .attr('points', function(d) {
        var x0 = d.x + d.w;
        var y0 = d.y + d.h;
        var x1 = props.search.x + props.search.w;
        var y1 = props.search.y + props.search.h;
        var x2 = props.search.x + props.search.w;
        var y2 = props.search.y;
        var x3 = d.x + d.w;
        var y3 = d.y;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon2')
      .attr('points', function(d) {
        var x0 = d.x + d.w;
        var y0 = d.y;
        var x1 = props.search.x + props.search.w;
        var y1 = props.search.y;
        var x2 = props.search.x;
        var y2 = props.search.y;
        var x3 = d.x;
        var y3 = d.y;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon3')
      .attr('points', function(d) {
        var x0 = d.x;
        var y0 = d.y;
        var x1 = props.search.x;
        var y1 = props.search.y;
        var x2 = props.search.x;
        var y2 = props.search.y + props.search.h;
        var x3 = d.x;
        var y3 = d.y + d.h;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    // window.select('.line0')
    //   .attr('x1', function(d) {return d.x})
    //   .attr('y1', function(d) {return d.y})
    //   .attr('x2', function(d) {return props.search.x + "px"})
    //   .attr('y2', function(d) {return props.search.y + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    // window.select('.line1')
    //   .attr('x1', function(d) {return d.x+d.w})
    //   .attr('y1', function(d) {return d.y})
    //   .attr('x2', function(d) {return props.search.x + props.search.w + "px"})
    //   .attr('y2', function(d) {return props.search.y + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    // window.select('.line2')
    //   .attr('x1', function(d) {return d.x+d.w})
    //   .attr('y1', function(d) {return d.y+d.h})
    //   .attr('x2', function(d) {return props.search.x + props.search.w + "px"})
    //   .attr('y2', function(d) {return props.search.y + props.search.h + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    // window.select('.line3')
    //   .attr('x1', function(d) {return d.x})
    //   .attr('y1', function(d) {return d.y+d.h})
    //   .attr('x2', function(d) {return props.search.x + "px"})
    //   .attr('y2', function(d) {return props.search.y + props.search.h + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    window.exit().remove();

    var heatmap = d3.select(el).selectAll('.heatmap')
        .each(function(d) {
          d3.select(this)
          .attr('width', dx)
          .attr('height', dy)
          // .call(function() { drawImageRowBlock(this, data, props.yblock, props.xblock);});
          .call(function() { drawSearchWindow(this, img_width, img_width, factor, 0, state.location);});
        });

    var searchmap = d3.select(el).selectAll('.search');

    searchmap.append('rect')
        .attr('x', function(d) {return 0})
        .attr('y', function(d) {return 0})
        .attr('width', function(d) {return props.search.w})
        .attr('height', function(d) {return props.search.h})
        .style('stroke', 'black')
        .style('stroke-width', '8px')
        .style('fill-opacity', 0.0)
        .style('stroke-opacity', 1.0);

    var cell_width = 2;
    var cell_height = 2;
    var x_offset = 6;
    var y_offset = 4;

    // searchmap
    searchmap.append('text')
      .attr('x', props.search.w/20 * (x_offset - 2))
      .attr('y', props.search.h/20 * (y_offset - 1.6))
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('(x,y)');

    searchmap.append('text')
      .attr('x', props.search.w/20 * (x_offset + cell_width*3))
      .attr('y', props.search.h/20 * (y_offset + cell_height))
      .attr('dy', '.91em')
      .attr('dx', '.3em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('3h');

    searchmap.append('text')
      .attr('x', props.search.w/20 * (x_offset + cell_width*1))
      .attr('y', props.search.h/20 * (y_offset + cell_height*3))
      .attr('dy', '.98em')
      .attr('dx', '.2em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('3w');

    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*2),
           "x2" : props.search.w/20 * (x_offset + cell_width*3),
           "y1" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "y2" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });
    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*0),
           "x2" : props.search.w/20 * (x_offset + cell_width*1),
           "y1" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "y2" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });
    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "x2" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "y1" : props.search.w/20 * (y_offset + cell_height*0),
           "y2" : props.search.w/20 * (y_offset + cell_height*1),
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });
    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "x2" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "y1" : props.search.w/20 * (y_offset + cell_height*2),
           "y2" : props.search.w/20 * (y_offset + cell_height*3),
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });

    lb = searchmap.selectAll('.lbp').data([0,0,0,0,0,0,0,0,0])
    lb.enter().append('rect')
      .attr('class', 'lbp')
      .attr('x', function(d, i) {return props.search.w/20 * (cell_width*((i%3)) + x_offset)})
      .attr('y', function(d, i) {return props.search.h/20 * (cell_height*(Math.floor(i/3)) + y_offset)})
      .attr('width', function(d) {return props.search.w/20 * cell_width})
      .attr('height', function(d) {return props.search.h/20 * cell_height})
      .style('fill', 'white')
      .style('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 1.0);

    lb.exit().remove();
    // for (var j = 0; j < 3; j++) {
    //   for (var i = 0; i < 3; i++) {
    //     searchmap.append('rect')
    //         .attr('x', function(d) {return props.search.w/20 * (cell_width*i + x_offset)})
    //         .attr('y', function(d) {return props.search.w/20 * (cell_height*j + y_offset)})
    //         .attr('width', function(d) {return props.search.w/20 * cell_width})
    //         .attr('height', function(d) {return props.search.h/20 * cell_height})
    //         .style('fill', 'white')
    //         .style('fill-opacity', 0.5)
    //         .style('stroke', 'black')
    //         .style('stroke-width', '2px')
    //         .style('stroke-opacity', 1.0);
    //   }
    // }
    x_edge = 60;
    x_next = x_edge + 20;
    y_start = 320;
    y_line = 24;

    var stage = d3.select(el).selectAll('.stage');

    stage.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('stage: 2/50, feature: 5/10');

    // stage.append('text')
    //   .attr('x', 0)
    //   .attr('y', y_line * 1.4)
    //   .attr('dy', '.81em')
    //   .attr('dx', '.1em')
    //   .style('text-anchor', 'start')
    //   .style('font-size', '24px')
    //   .text('feature: 5/10');

    stage.append('text')
      .attr('x', 0)
      .attr('y', y_line * 1.4*1)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('x: 10, y: 10, w: 2, h: 2');

    stage.append('text')
      .attr('x', 0)
      .attr('y', y_line * 1.4*2)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('LUT: [0,0,1,0,1,1,1,0,...');


    var feature = d3.select(el).selectAll('.feature');
    // feature.append('rect')
    //     .attr('x', function(d) {return 0})
    //     .attr('y', function(d) {return 0})
    //     .attr('width', function(d) {return props.feature.w})
    //     .attr('height', function(d) {return props.feature.h})
    //     .style('stroke', 'black')
    //     .style('stroke-width', '8px')
    //     .style('fill-opacity', 0.0)
    //     .style('stroke-opacity', 1.0);

    var labels = [
        {x: 0, y: 0,                                 label: 1},
        {x: props.feature.w/2, y: 0,                 label: 2},
        {x: 0, y: props.feature.h/2,                 label: 3},
        {x: props.feature.w/2, y: props.feature.h/2, label: 4},
    ];
    var radius = 20;
    var offset = 12;

    feature_enter = feature.selectAll('.step').data(labels)
      .enter().append('g')
      .attr('class', 'step')
      .attr('transform', function(d) { 
        var x = d.x + radius + offset;
        var y = d.y + radius + offset;
        return 'translate(' + x + ', ' + y + ')'})


        // feature_enter.append('circle')
        // .attr('r', function(d) {return radius})
        // .style('fill', 'white')
        // .style('stroke', 'black')
        // .style('stroke-width', '4px');

        feature_enter.append('text')
          .attr('y', - radius)
          .attr('dy', '.71em')
          .style('text-anchor', 'middle')
          .text(function(d, i) { return i + 1});

    var lbp1 = [0, 0, 200,
                40, 100, 40,
                160,  160 ,160];
    f1 = feature.selectAll('.fig1').data(lbp1)
      .enter().append('g')
      .attr('class', 'fig1')
      .attr('transform', 'translate('+80 + ', ' + 80+')');

      f1.append('rect')
      .attr('x', function(d, i) {return props.feature.w/24 * (cell_width*(i%3))})
      .attr('y', function(d, i) {return props.feature.w/24 * (cell_height*Math.floor(i/3))})
      .attr('width', function(d) {return props.feature.w/24 * cell_width})
      .attr('height', function(d) {return props.feature.h/24 * cell_height})
      .style('fill', function(d) {return d3.rgb(d,d,d);})
      .style('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 1.0)

    var lbp2 = [0, 0, 1,
                0, ' ', 0,
                1,  1 ,1];

    f2 = feature.selectAll('.fig2').data(lbp2)
      .enter().append('g')
      .attr('class', 'fig2')
      .attr('transform', 'translate('+340 + ', ' + 80+')');

      f2.append('rect')
      .attr('x', function(d, i) {return props.feature.w/24 * (cell_width*(i%3))})
      .attr('y', function(d, i) {return props.feature.w/24 * (cell_height*Math.floor(i/3))})
      .attr('width', function(d) {return props.feature.w/24 * cell_width})
      .attr('height', function(d) {return props.feature.h/24 * cell_height})
      .style('fill', 'white')
      .style('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 1.0)

      f2.append('text')
        .attr('x', function(d, i) {return props.feature.w/24 * (cell_width*(i%3))})
        .attr('y', function(d, i) {return props.feature.w/24 * (cell_height*Math.floor(i/3))})
        .attr('dy', '1.2em')
        .attr('dx', '0.4em')
        .style('font-size', '24px')
        .style('text-anchor', 'start')
        .text(function(d) { return d});


    feature.append('text')
      .attr('x', 320)
      .attr('y', 220)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('"00101110" == 56');

    
    feature.append('text')
      .attr('x', x_edge)
      .attr('y', y_start)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('if (LUT[56]) {');

    feature.append('text')
      .attr('x', x_next)
      .attr('y', y_start + y_line*1)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text(' VALUE = PASS');

    feature.append('text')
      .attr('x', x_edge)
      .attr('y', y_start + y_line*2)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('} else {');

    feature.append('text')
      .attr('x', x_next)
      .attr('y', y_start + y_line*3)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text(' VALUE = FAIL');

    feature.append('text')
      .attr('x', x_edge)
      .attr('y', y_start + y_line*4)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('}');


    feature.append('text')
      .attr('x', 320)
      .attr('y', y_start + y_line*1)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('STAGE += VALUE');

    var every15 = Array.apply(null, Array(255/15 + 1)).map(function(_, i) {return i * 15;}).reverse();

    if (props.legend) {
      var legend = chart.selectAll('.legend')
            .data(color.ticks(10).reverse())
            // .data(every15)
            .enter().append('g')
            .attr('class', 'legend')
            .attr('transform', function(d, i) {return 'translate(' + (width + 20) + ',' + (10 + i *20) + ')';});


      legend.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .style("stroke", function (d) { return "black";})
        .style("fill", color)

      var legendFormat = d3.format();
      if(props.percent) {
        legendFormat = d3.format('%');
      }

      legend.append("text")
        .attr("x", 26)
        .attr("y", 10)
        .attr("dy", ".35em")
        .text(function(d) {return legendFormat(d);});
    }

    if (props.grid) {
      if (props.axis) {
        chart.append('g')
          .attr('class', 'x axis')
          .attr("transform", "translate("+width/3/2/(data[0].length)+", " + height + ")")
          .call(axis.x);

        chart.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(0, "  + - height/3/data.length + ")")
          .call(axis.y);
      }

    chart.selectAll("line.ygrid")
      .data(scales.y.ticks(6))
    .enter()
      .append("line")
      .attr(
           {
           "class":"ygrid",
           "x1" : 0,
           "x2" : width/2,
           "y1" : function(d){ return scales.y(d);},
           "y2" : function(d){ return scales.y(d);},
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
           });

    chart.selectAll("line.xgrid")
      .data(scales.x.ticks(6))
    .enter()
      .append("line")
      .attr(
           {
           "class":"xgrid",
           "y1" : 0,
           "y2" : height,
           "x1" : function(d){ return scales.x(d);},
           "x2" : function(d){ return scales.x(d);},
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
           });
    } else {
      if (props.axis) {
        chart.append('g')
          .attr('class', 'x axis')
          .attr("transform", "translate(0, " + height + ")")
          .call(axis.x);

        chart.append("g")
          .attr("class", "y axis")
          .call(axis.y);
      }
    }
  }

  function drawImage(canvas, data) {
    var context = canvas.node().getContext("2d"),
      image = context.createImageData(dx,dy);
    for (var y = 0, p = -1; y < dy; ++y) {
      for (var x = 0; x < dx; ++x) {
        if(data[y][x] == -1) {
          image.data[++p] = 0;
          image.data[++p] = 0;
          image.data[++p] = 0;
          image.data[++p] = 0;
        } else {
          var c = d3.rgb(color(data[y][x]));
          image.data[++p] = c.r;
          image.data[++p] = c.g;
          image.data[++p] = c.b;
          image.data[++p] = 255;
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawImageRowBlock(canvas, data, yblock,xblock) {
    var total = 0;
    var context = canvas.node().getContext("2d"),
      image = context.createImageData(dx,dy);
    if (yblock == 1 && xblock == 1) {
      for (var y = 0, p = -1; y < dy; ++y) {
        for (var x = 0; x < dx; ++x) {
          if(data[y][x] == -1) {
            image.data[++p] = 0;
            image.data[++p] = 0;
            image.data[++p] = 0;
            image.data[++p] = 0;
          } else {
            var c = d3.rgb(color(data[y][x]));
            image.data[++p] = c.r;
            image.data[++p] = c.g;
            image.data[++p] = c.b;
            image.data[++p] = 255;
          }
        }
      }
    } else {
      for (var y = 0, p = -1; y < dy; y+=yblock) {
        for (var x = 0; x < dx; x+=xblock) {
          var max = 0;
          for (var yb = 0; yb < yblock && yb+y < dy; ++yb) {
            var row_max = 0;
            for (var xb = 0; xb < xblock && xb+x < dx; ++xb) {
              if (data[y+yb][x+xb] > row_max) {
                row_max = data[y+yb][x+xb];
              }
            }
            if (row_max > max) {
              max = row_max;
            }
          }
          for (var yb = 0; yb < yblock && yb+y < dy; ++yb) {
            for (var xb = 0; xb < xblock && xb+x < dx; ++xb) {
              var c = d3.rgb(color(max));
              var pos = (y+yb)*4 * dx + (x+xb)*4;
              image.data[pos++] = c.r;
              image.data[pos++] = c.g;
              image.data[pos++] = c.b;
              image.data[pos++] = 255;
              total += max;
            }
          }
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawSearchWindow(canvas, orig_w, orig_h, factor, iteration, loc) {
    var scale = Math.pow(factor, iteration);
    var context = canvas.node().getContext("2d");
    context.globalAlpha = 1.0;

    if (ns._imgReady) {
      console.log(ns._imgReady);
      var src = {x: loc.x*scale, y: loc.y*scale, w: loc.w*scale, h: loc.h*scale};
      var dest  = {x: 0, y: 0, w: orig_w, h: orig_h};
      context.drawImage(ns._img, src.x, src.y,
                               src.w, src.h,
                               dest.x, dest.y,
                               dest.w, dest.h);
    }
  }

};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less","./d3Pos.less":"/home/jedwards/rlbp2/src/d3Pos.less"}],"/home/jedwards/rlbp2/src/d3CanvasHeat.js":[function(require,module,exports){
require('./d3Pos.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 90, bottom: 60, left: 70}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {
  container = d3.select(el).append('div')
    .attr('class', 'rel')
    .style('width', props.width + "px")
    .style('height', props.height + "px")


  container.append('div')
  .attr('class', 'abs')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
  .style('left', this._margin.left + "px")
  .style('top', this._margin.top + "px")
    .append('canvas')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
    .attr('class', 'image abs');

  container.append('div')
  .attr('class', 'abs')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
  .style('left', this._margin.left + "px")
  .style('top', this._margin.top + "px")
    .append('canvas')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
    .attr('class', 'heatmap abs')
    .classed('pixelated', props.pixelated);

 container.append('svg')
    .attr('class', 'abs')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');


  this.update(el, props, state);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .tickValues([1,2,3,4,5,6])
              .tickFormat(d3.format("d"))
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .tickValues([1,2,3,4,5,6])
              .tickFormat(d3.format("d"))
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);
  var x = d3.scale.linear()
          .range([0, width]);

  return {x: x, y: y};
}

ns.update = function(el, props, state) {
  var margin = this._margin;
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  var data = null
  if (state.data && state.data.length > 0 && Array.isArray(state.data[0])) {
    data = state.data;
  } else {
    for (var i in state.data) {
      if (state.data[i].scale == props.scale) {
        data = state.data[i].data;
      }
    }
  }


  if (data) {

    if (props.percent) {
      var sum = d3.sum(data, function(d) { return d3.sum(d); });
      data = data.map(function(d) { return d.map(function(d) {return 1.0 * d / sum;}); });
      data = data.reverse();
    }

    var dx = data[0].length;
    var dy = data.length;

    var start = 1;
    scales.x.domain([start, dx+start]);
    scales.y.domain([start, dy+start]);

    var colorDomain = [0, d3.max(data, function(d) { return d3.max(d);})];
    if (props.percent) {
      colorDomain = [0, 0.05, 1];
      colorRange = ['rgb(255,255,255)','rgb(255,255,217)','rgb(237,248,177)','rgb(199,233,180)','rgb(127,205,187)','rgb(65,182,196)','rgb(29,145,192)','rgb(34,94,168)','rgb(37,52,148)','rgb(8,29,88)'];
      colorRange = ['rgb(255,255,255)', 'rgb(127,205,187)', 'rgb(8,29,88)'];
    }
    var color;
    if (props.grey) {
      color = d3.scale.linear()
                  .domain(colorDomain)
                  // .range(["#000000","#ffffff"].reverse());
                  .range(["#000000","#ffffff"]);
    } else {
      color = d3.scale.linear()
                  .domain(colorDomain)
                  .range(colorRange);
    }

    var chart = d3.select(el).select('.chart');

    // chart.append('g')
    //     .attr('transform', 'translate(' + width/2 + ',' + height +  ')')
    //     .append('text')
    //     .attr('class', 'axis')
    //     .attr('text-anchor', 'middle')
    //     .attr("dy", "2.35em")
    //     .text('Width');

    // chart.append('g')
    //     .attr('transform', 'translate(' + -70 + ',' + height/2 +  ')')
    //     .append('text')
    //     .attr('class', 'axis')
    //     .attr('text-anchor', 'middle')
    //     .attr('transform', 'rotate(-90)')
    //     .attr("dy", "2.35em")
    //     .text('Height');
        
    var heatmap = d3.select(el).select('.heatmap')
        .attr('width', dx)
        .attr('height', dy)
        .call(function() { drawImageRowBlock(this, data, props.yblock, props.xblock);});


    var every15 = Array.apply(null, Array(255/15 + 1)).map(function(_, i) {return i * 15;}).reverse();

    if (props.legend) {
      box = 25;
      var legend = chart.selectAll('.legend')
            .data(color.ticks(10).reverse())
            // .data(every15)
            .enter().append('g')
            .attr('class', 'legend')
            .attr('transform', function(d, i) {return 'translate(' + (width + box) + ',' + (i *box) + ')';});


      legend.append("rect")
        .attr("width", box)
        .attr("height", box)
        .style("stroke", function (d) { return "black";})
        .style("fill", color)

      var legendFormat = d3.format();
      if(props.percent) {
        legendFormat = d3.format('%');
      }

      legend.append("text")
        .attr("x", box+6)
        .attr("y", 10)
        .attr("dy", ".35em")
        .text(function(d) {return legendFormat(d);});
    }

    if (props.grid) {
      if (props.axis) {
        chart.append('g')
          .attr('class', 'x axis')
          .attr("transform", "translate("+width/2/(data[0].length)+", " + height + ")")
          .call(axis.x);

        chart.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(0, "  + - height/2/data.length + ")")
          .call(axis.y);
      }

    chart.selectAll("line.ygrid")
      .data(scales.y.ticks(6))
    .enter()
      .append("line")
      .attr(
           {
           "class":"ygrid",
           "x1" : 0,
           "x2" : width,
           "y1" : function(d){ return scales.y(d);},
           "y2" : function(d){ return scales.y(d);},
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
           });

    chart.selectAll("line.xgrid")
      .data(scales.x.ticks(6))
    .enter()
      .append("line")
      .attr(
           {
           "class":"xgrid",
           "y1" : 0,
           "y2" : height,
           "x1" : function(d){ return scales.x(d);},
           "x2" : function(d){ return scales.x(d);},
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
           });
    } else {
      if (props.axis) {
        chart.append('g')
          .attr('class', 'x axis')
          .attr("transform", "translate(0, " + height + ")")
          .call(axis.x);

        chart.append("g")
          .attr("class", "y axis")
          .call(axis.y);
      }
    }
  }

  function drawImage(canvas, data) {
    var context = canvas.node().getContext("2d"),
      image = context.createImageData(dx,dy);
    for (var y = 0, p = -1; y < dy; ++y) {
      for (var x = 0; x < dx; ++x) {
        if(data[y][x] == -1) {
          image.data[++p] = 0;
          image.data[++p] = 0;
          image.data[++p] = 0;
          image.data[++p] = 0;
        } else {
          var c = d3.rgb(color(data[y][x]));
          image.data[++p] = c.r;
          image.data[++p] = c.g;
          image.data[++p] = c.b;
          image.data[++p] = 255;
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawImageRowBlock(canvas, data, yblock,xblock) {
    var total = 0;
    var context = canvas.node().getContext("2d"),
      image = context.createImageData(dx,dy);
    if (yblock == 1 && xblock == 1) {
      for (var y = 0, p = -1; y < dy; ++y) {
        for (var x = 0; x < dx; ++x) {
          if(data[y][x] == -1) {
            image.data[++p] = 0;
            image.data[++p] = 0;
            image.data[++p] = 0;
            image.data[++p] = 0;
          } else {
            var c = d3.rgb(color(data[y][x]));
            image.data[++p] = c.r;
            image.data[++p] = c.g;
            image.data[++p] = c.b;
            image.data[++p] = 255;
          }
        }
      }

    } else {
      for (var y = 0, p = -1; y < dy; y+=yblock) {
        for (var x = 0; x < dx; x+=xblock) {
          var max = 0;
          for (var yb = 0; yb < yblock && yb+y < dy; ++yb) {
            var row_max = 0;
            for (var xb = 0; xb < xblock && xb+x < dx; ++xb) {
              if (data[y+yb][x+xb] > row_max) {
                row_max = data[y+yb][x+xb];
              }
            }
            if (row_max > max) {
              max = row_max;
            }
          }
          for (var yb = 0; yb < yblock && yb+y < dy; ++yb) {
            for (var xb = 0; xb < xblock && xb+x < dx; ++xb) {
              var c = d3.rgb(color(max));
              var pos = (y+yb)*4 * dx + (x+xb)*4;
              image.data[pos++] = c.r;
              image.data[pos++] = c.g;
              image.data[pos++] = c.b;
              image.data[pos++] = 255;
              total += max;
            }
          }
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less","./d3Pos.less":"/home/jedwards/rlbp2/src/d3Pos.less"}],"/home/jedwards/rlbp2/src/d3Feature.js":[function(require,module,exports){
// var d3 = require('d3');

// require('./d3Feature.less');
require('./d3Axis.less');

var ns = {};

ns._width = function(props) { return props.width; };
ns._height = function(props) { return props.height; };

ns.create = function(el, props, state) {

  var svg = d3.select(el).append('svg')
      .attr('width', props.width)
      .attr('height', props.height);

  this.update(el, props);
};

ns.update = function(el, props) {
  width = this._width(props);
  height = this._height(props);

  var rect0 = {x: 0, y: 0, w: 30, h: 30, color: "white"};
  var rect1 = {x: 15, y: 15, w: 15, h: 15, color: "black"};
  var rect2 = {x: 0, y: 0, w: 15, h: 15, color: "black"};

  var rect3 = {x: 0, y: 0, w: 40, h: 30, color: "white"};
  var rect4 = {x: 10, y: 0, w: 20, h: 30, color: "black"};

  var rect5 = {x: 0, y: 0, w: 40, h: 40, color: "white"};
  var rect6 = {x: 0, y: 20, w: 40, h: 20, color: "black"};

  var feat0 = {x: 10, y: 20, rects: [rect0, rect1, rect2]};
  var feat1 = {x: 20, y: 60, rects: [rect3, rect4]};
  var feat2 = {x: 50, y: 10, rects: [rect5, rect6]};

  var features1 = [feat0, feat1, feat2];
  var window1 = {x: 40, y: 40, w: 100, h: 100, color: "white", features: features1, text: "a) example Haar features"};


  var lbp = function(w, h) {
    var arr = [];
    for (var j = 0; j < 3; j++ ) {
      for (var i = 0; i < 3; i++ ) {
        arr.push({x: w*i, y: h*j, w: w, h: h, color: "white"});
      }
    }

    arr[4].color = "black";
    return arr;
  }

  var feat3 = {x: 64, y: 6, rects: lbp(10, 20)};
  var feat4 = {x: 20, y: 70, rects: lbp(10, 8)};
  var feat5 = {x: 8, y: 12, rects: lbp(16, 16)};
  var features1 = [feat3, feat4, feat5];
  var window2 = {x: 240, y: 40, w: 100, h: 100, color: "white", features: features1, text: "b) example LBP features"};

  windows = [window1, window2];


  var window = d3.select(el).selectAll('svg').selectAll('g').data(windows)
                  .enter().append('g')
                  .attr('transform', function(d) { return 'translate('+d.x + ','+d.y+')';});

  window.append('rect')
          .attr('width', function(d) { return d.w;})
          .attr('height', function(d) { return d.h;})
          .attr('fill', function(d) { return d.color;})
          .attr('stroke', 'black')
          .attr('stroke-width', '2px');

  window.append('text')
        .attr('class', 'axis')
        .attr("x", 0)
        .attr("y", 100 + 20)
        .attr("dy", ".35em")
        .text(function(d) {return d.text; });

  window.each(function(d) {
     var feats = d3.select(this).selectAll('.feat').data(d.features);

     feats.enter().append('g')
      .attr('class', 'feat')
      .attr('transform', function(d) { return 'translate('+d.x + ','+ d.y+')'})
      .each(function(d) {
        var rects = d3.select(this).selectAll('rect').data(d.rects);

        rects.enter().append('rect')
          .attr('x', function(d) {return d.x; })
          .attr('y', function(d) {return d.y; })
          .attr('width', function(d) {return d.w; })
          .attr('height', function(d) {return d.h; })
          .attr('fill', function(d) {return d.color})
          .attr('stroke', 'black')
          .attr('stroke-width', '2px');
    });
  });
};

ns.destroy = function(el) {

};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less"}],"/home/jedwards/rlbp2/src/d3GroupBar.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3Legend.less');
require('./d3Bar.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 40, right: 20, bottom: 30, left: 60}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {

  d3.select(el).append('svg')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._color = function() {
  var color = d3.scale.ordinal()
              // .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
              .range(["#98abc5", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
              // .range(["#98abc5", "#7b6888", "#a05d56", "#d0743c", "#ff8c00"]);
  return color;
}
ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x0)
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left')
              .tickValues([1e0, 1e1, 1e2, 1e3, 1e4])
              .tickFormat(d3.format('.s'));
              // .tickFormat(d3.format('.2s'));

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.log()
          .range([height, 0]);

  var x0 = d3.scale.ordinal()
          .rangeRoundBands([0, width], .1);
  var x1 = d3.scale.ordinal();

  return {x0: x0, x1: x1, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);
  var color = this._color();

  d3.csv(props.csv, function (error, data) {
    if (error) throw err;

    var ageNames = d3.keys(data[0]).filter(function(key) { return key !== 'State';});

    data.forEach(function(d) {
      d.ages = ageNames.map(function(name) { return {name: name, value: +d[name]}; });
    });
    

    scales.x0.domain(data.map(function(d) { return d.State; }));
    scales.x1.domain(ageNames).rangeRoundBands([0, scales.x0.rangeBand()]);
    scales.y.domain([d3.min(data, function(d) { return d3.min(d.ages, function(d) {return d.value; }); }), d3.max(data, function(d) { return d3.max(d.ages, function(d) {return d.value; }); })]);
    scales.y.domain([1, d3.max(data, function(d) { return d3.max(d.ages, function(d) {return d.value; }); })]);

    var chart = d3.select(el).select('.chart');

    chart.append('g')
      .attr('class', 'x axis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x);

    chart.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + - 3 + ",0)")
      .call(axis.y)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('ms per frame');


    // data join (enter only)
    var state = chart.selectAll('.state')
           .data(data)
           .enter().append('g')
           .attr('class', 'state')
           .attr('transform', function(d) { return "translate(" + scales.x0(d.State) + ", 0)"; });

    state.selectAll('rect')
        .data(function(d) {return d.ages;})
        .enter().append('rect')
        .attr("width", scales.x1.rangeBand())
        .attr("x", function(d) { return scales.x1(d.name); })
        .attr("y", function(d) { return scales.y(d.value); })
        .attr("height", function(d) { return height - scales.y(d.value); })
        .style('fill', function(d) { return color(d.name); });

    // state.selectAll('text')
    //     .data(function(d) {return d.ages;})
    //     .enter().append('text')
    //     .attr('class', 'axis')
    //     .attr("x", function(d) { return scales.x1(d.name) + scales.x1.rangeBand()/2; })
    //     .attr("y", function(d) { return scales.y(d.value); })
    //     .attr("dy", "-.35em")
    //     .style("text-anchor", "middle")
    //     .text(function(d) {
    //         return d.value;
    //     });

    var legend = chart.selectAll('.legend')
        // .data(color.domain().slice().reverse())
        .data(color.domain().slice())
        .enter().append('g')
        .attr('class', 'legend')
        .attr('transform', function(d, i) { return 'translate(0, ' + i * 20 + ')'; });

        var legend_offset = 20;
    legend.append('rect')
      .attr('x', legend_offset + width - 18)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', color)
    legend.append('text')
        .attr("x", legend_offset + width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(function(d) {return d; });
  });

  function type(d) {
    d.value = +d.value; //coerce to number
    return d;
  }

  function add_percent(d, n) {
    percent = +(d.split("%")[0])
    newPercent = percent + n
    return "" + newPercent + "%";
  }
};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less","./d3Bar.less":"/home/jedwards/rlbp2/src/d3Bar.less","./d3Legend.less":"/home/jedwards/rlbp2/src/d3Legend.less"}],"/home/jedwards/rlbp2/src/d3HAxis.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".haxis text{font:10px sans-serif !important}.haxis path,.haxis line{fill:none;stroke:#000;shape-rendering:crispEdges}.y.haxis path{display:none}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3HBar.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3HBar.less');
require('./d3HAxis.less');

var ns = {};

ns._margin = {top: 20, right: 30, bottom: 30, left: 40}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {
  d3.select(el).append('svg')
      .attr('width', props.width)
      .attr('height', props.width)
      .append('g')
      .attr('class', 'chart')
      .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom')
              .ticks(10, '%');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var x = d3.scale.linear()
          .range([0, width]);
  var y = d3.scale.ordinal()
          .rangeRoundBands([0, height], .1);

  return {x: x, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  d3.csv(props.csv, type, function (error, data) {
    scales.x.domain([0, d3.max(data, function(d) { return d.value; })]);
    scales.y.domain(data.map(function(d) {return d.name; }));

    var chart = d3.select(el).select('.chart');

    chart.append('g')
      .attr('class', 'x haxis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x)
      .append('text')
      .attr('y', 6)
      .attr('dy', '.35em')
      .style('text-anchor', 'middle')
      .text('Frequency');

    chart.append("g")
      .attr("class", "y haxis")
      .call(axis.y);

    // data join (enter only)
    var bar = chart.selectAll('.hbar')
           .data(data)
           .enter().append('g')
           .attr('class', 'hbar')
           .attr('transform', function(d) { return "translate(0," + scales.y(d.name) + ")"; });

    bar.append('rect')
        .attr("width", function(d) { return scales.x(d.value); })
        .attr("height", scales.y.rangeBand());

    bar.append('text')
        .attr("x", function(d) { return scales.x(d.value) - 3; })
        .attr("y", scales.y.rangeBand() / 2)
        .attr("dy", ".35em")
        .text(function(d) {return Math.round(d.value * 1000)/10.0;});
  });

  function type(d) {
    d.value = +d.value; //coerce to number
    return d;
  }

  function add_percent(d, n) {
    percent = +(d.split("%")[0])
    newPercent = percent + n
    return "" + newPercent + "%";
  }
};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3HAxis.less":"/home/jedwards/rlbp2/src/d3HAxis.less","./d3HBar.less":"/home/jedwards/rlbp2/src/d3HBar.less"}],"/home/jedwards/rlbp2/src/d3HBar.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".hbar rect{fill:steelblue}.hbar:hover rect{fill:red !important}.hbar text{visibility:hidden !important;fill:white !important;font:10px sans-serif !important;text-anchor:end !important}.hbar:hover text{visibility:visible !important}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3Heat.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3Bar.less');
require('./d3Tile.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 90, bottom: 30, left: 50}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {

  d3.select(el).append('svg')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._axis = function(scales) {
  var formatDate = d3.time.format("%b %d");
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom')
              .ticks(d3.time.days)
              .tickFormat(formatDate);

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var z = d3.scale.linear()
          .range(["white", "steelblue"]);
  var y = d3.scale.linear()
          .range([height, 0]);
  var x = d3.time.scale()
          .range([0, width]);

  return {x: x, y: y, z: z};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);
  var parseDate = d3.time.format("%Y-%m-%d").parse;
  var xStep = 864e5,
      yStep = 100;

  d3.csv(props.csv, type, function (error, data) {
    if (error) throw error;

    scales.x.domain(d3.extent(data, function(d) {return d.date; }));
    scales.y.domain(d3.extent(data, function(d) {return d.bucket; }));
    scales.z.domain([0, d3.max(data, function(d) { return d.count; })]);

    scales.x.domain([scales.x.domain()[0], +scales.x.domain()[1] + xStep]);
    scales.y.domain([scales.y.domain()[0], +scales.y.domain()[1] + yStep]);

    var chart = d3.select(el).select('.chart');



    // data join (enter only)
    var tile = chart.selectAll('.tile')
           .data(data)
           .enter().append('rect')
           .attr('class', 'tile')
           .attr("x", function(d) { return scales.x(d.date); })
           .attr("y", function(d) { return scales.y(d.bucket + yStep); })
           .attr("width", scales.x(xStep) - scales.x(0))
           .attr("height", scales.y(0) - scales.y(yStep) )
           .style('fill', function(d) { return scales.z(d.count); });

    var legend = chart.selectAll('.legend')
          .data(scales.z.ticks(6).slice(1).reverse())
          .enter().append('g')
          .attr('class', 'legend')
          .attr('transform', function(d, i) {return 'translate(' + (width +20) + ',' + (20 + i *20) + ')';});

    legend.append("rect")
      .attr("width", 20)
      .attr("height", 20)
      .style("fill", scales.z);

    legend.append("text")
      .attr("x", 26)
      .attr("y", 10)
      .attr("dy", ".35em")
      .text(String);

    chart.append('g')
      .attr('class', 'x axis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x);

    chart.append("g")
      .attr("class", "y axis")
      .call(axis.y)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Value');

  });

  function type(d) {
    d.date = parseDate(d.date);
    d.bucket = +d.bucket;
    d.count = +d.count; //coerce to number
    return d;
  }

  function add_percent(d, n) {
    percent = +(d.split("%")[0])
    newPercent = percent + n
    return "" + newPercent + "%";
  }
};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less","./d3Bar.less":"/home/jedwards/rlbp2/src/d3Bar.less","./d3Tile.less":"/home/jedwards/rlbp2/src/d3Tile.less"}],"/home/jedwards/rlbp2/src/d3Legend.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".legend text{font:10px sans-serif !important}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3Letters.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3Letters.less');

var ns = {};

ns.create = function(el, props, state) {
  var svg = d3.select(el).append('svg')
      .attr('width', props.width)
      .attr('height', props.height);

  this.update(el, state);
};

ns.update = function(el, state) {
  // data join
  var text = d3.select(el).selectAll('text')
         .data(state.data);

  // update
  text.attr('class', 'update');

  // enter
  text.enter().append('text')
      .attr('class', 'enter')
      .attr('x', function(d, i) { return i * 32; })
      .attr('dy', '.35em');

  // enter + update
  text.text(function(d) {return d; });

  // exit
  text.exit().remove();
};

ns.destroy = function(el) {

};

module.exports = ns;

},{"./d3Letters.less":"/home/jedwards/rlbp2/src/d3Letters.less"}],"/home/jedwards/rlbp2/src/d3Letters.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = "text{font:bold 48px monospace}.enter{color:#1abc9c}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3Line.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3Line.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 30, bottom: 30, left: 40}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {

  d3.select(el).append('svg')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);

  var x = d3.time.scale()
          .range([0, width]);

  return {x: x, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  var parseDate = d3.time.format("%d-%b-%y").parse;
  var line = d3.svg.line()
               .x(function(d) {return scales.x(d.date); })
               .y(function(d) {return scales.y(d.close); });


  d3.csv(props.csv, type, function (error, data) {
    if (error) throw err;

    scales.x.domain(d3.extent(data, function(d) {return d.date; }));
    scales.y.domain(d3.extent(data, function(d) {return d.close; }));

    var chart = d3.select(el).select('.chart');

    chart.append('g')
      .attr('class', 'x axis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x);

    chart.append("g")
      .attr("class", "y axis")
      .call(axis.y)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Profit ($)');

      // data join (enter only)
      chart.append('path')
        .datum(data)
        .attr('class', 'line')
        .attr('d', line);


  });

  function type(d) {
    d.date = parseDate(d.date);
    d.close = +d.close; //coerce to number
    return d;
  }

  function add_percent(d, n) {
    percent = +(d.split("%")[0])
    newPercent = percent + n
    return "" + newPercent + "%";
  }
};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less","./d3Line.less":"/home/jedwards/rlbp2/src/d3Line.less"}],"/home/jedwards/rlbp2/src/d3Line.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".line{fill:none;stroke:steelblue;stroke-width:1.5px}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3MXP.js":[function(require,module,exports){
// var d3 = require('d3');

// require('./d3Feature.less');
require('./d3Axis.less');

var ns = {};

ns._width = function(props) { return props.width; };
ns._height = function(props) { return props.height; };

ns.create = function(el, props, state) {

  var svg = d3.select(el).append('svg')
      .attr('width', props.width)
      .attr('height', props.height);

  this.update(el, props);
};

ns.update = function(el, props) {
  width = this._width(props);
  height = this._height(props);

  // var rect0 = {x: 0, y: 0, w: 30, h: 30, color: "white"};
  // var rect1 = {x: 15, y: 15, w: 15, h: 15, color: "black"};
  // var rect2 = {x: 0, y: 0, w: 15, h: 15, color: "black"};

  // var rect3 = {x: 0, y: 0, w: 40, h: 30, color: "white"};
  // var rect4 = {x: 10, y: 0, w: 20, h: 30, color: "black"};

  // var rect5 = {x: 0, y: 0, w: 40, h: 40, color: "white"};
  // var rect6 = {x: 0, y: 20, w: 40, h: 20, color: "black"};

  // var feat0 = {x: 10, y: 20, rects: [rect0, rect1, rect2]};
  // var feat1 = {x: 20, y: 60, rects: [rect3, rect4]};
  // var feat2 = {x: 50, y: 10, rects: [rect5, rect6]};

  // var features1 = [feat0, feat1, feat2];
  // var window1 = {x: 40, y: 40, w: 100, h: 100, color: "white", features: features1, text: "a) example Haar features"};


  var lbp = function(w, h) {
    w *= 10
    h *= 10
    var arr = [];
    for (var j = 0; j < 3; j++ ) {
      for (var i = 0; i < 3; i++ ) {
        arr.push({x: w*i, y: h*j, w: w, h: h, color: "white"});
      }
    }

    arr[4].color = "black";
    return arr;
  }

  var feat3 = {x: 0, y: 8*2+90, rects: lbp(4, 4)};
  var feat4 = {x: 0, y: 8*1+30, rects: lbp(2, 2)};
  var feat5 = {x: 0, y: 0, rects: lbp(1, 1)};
  var features1 = [feat3, feat4, feat5];
  var window2 = {x: 0, y: 0, w: 200, h: 300, color: "white", features: features1, text: "b) example LBP features"};

  // windows = [window1, window2];
  windows = [window2];


  var window = d3.select(el).selectAll('svg').selectAll('g').data(windows)
                  .enter().append('g')
                  .attr('transform', function(d) { return 'translate('+d.x + ','+d.y+')';});

  window.append('rect')
          .attr('width', function(d) { return d.w;})
          .attr('height', function(d) { return d.h;})
          .attr('fill', function(d) { return d.color;})
          .attr('stroke', 'black')
          .attr('fill', 'none')
          .attr('stroke', 'none')
          .attr('stroke-width', '2px');

  // window.append('text')
  //       .attr('class', 'axis')
  //       .attr("x", 0)
  //       .attr("y", 100 + 20)
  //       .attr("dy", ".35em")
  //       .text(function(d) {return d.text; });

  window.each(function(d) {
     var feats = d3.select(this).selectAll('.feat').data(d.features);

     feats.enter().append('g')
      .attr('class', 'feat')
      .attr('transform', function(d) { return 'translate('+d.x + ','+ d.y+')'})
      .each(function(d) {
        var rects = d3.select(this).selectAll('rect').data(d.rects);

        rects.enter().append('rect')
          .attr('x', function(d) {return d.x; })
          .attr('y', function(d) {return d.y; })
          .attr('width', function(d) {return d.w; })
          .attr('height', function(d) {return d.h; })
          .attr('fill', function(d) {return d.color})
          .attr('stroke', 'black')
          .attr('stroke-width', '2px');
    });
  });
};

ns.destroy = function(el) {

};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less"}],"/home/jedwards/rlbp2/src/d3Pos.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".abs{position:absolute}.rel{position:relative}.pixelated{image-rendering:pixelated}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3StackedBar.js":[function(require,module,exports){
// var d3 = require('d3');

require('./d3Legend.less');
require('./d3Bar.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 30, bottom: 30, left: 40}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {

  d3.select(el).append('svg')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._color = function() {
  var color = d3.scale.ordinal()
              .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
  return color;
}
ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left')
              .tickFormat(d3.format('.2s'));

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);

  var x = d3.scale.ordinal()
          .rangeRoundBands([0, width], .1);

  return {x: x, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);
  var color = this._color();

  d3.csv(props.csv, function (error, data) {
    if (error) throw err;

    color.domain(d3.keys(data[0]).filter(function(key) { return key !== 'State';}));

    data.forEach(function(d) {
      var y0 = 0;
      d.ages = color.domain().map(function(name) { return {name:name, y0:y0, y1: y0 += +d[name]};});
      d.total = d.ages[d.ages.length -1].y1;
    });

    data.sort(function(a, b) { return b.total - a.total; });

    scales.x.domain(data.map(function(d) {return d.State; }));
    scales.y.domain([0, d3.max(data, function(d) { return d.total; })]);

    var chart = d3.select(el).select('.chart');

    chart.append('g')
      .attr('class', 'x axis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x);

    chart.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + - 3 + ",0)")
      .call(axis.y)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Population');


    // data join (enter only)
    var state = chart.selectAll('.state')
           .data(data)
           .enter().append('g')
           .attr('class', 'state')
           .attr('transform', function(d) { return "translate(" + scales.x(d.State) + ", 0)"; });

    state.selectAll('rect')
        .data(function(d) {return d.ages;})
        .enter().append('rect')
        .attr("width", scales.x.rangeBand())
        .attr("y", function(d) { return scales.y(d.y1); })
        .attr("height", function(d) { return scales.y(d.y0) - scales.y(d.y1); })
        .style('fill', function(d) { return color(d.name); });

    var legend = chart.selectAll('.legend')
        .data(color.domain().slice().reverse())
        .enter().append('g')
        .attr('class', 'legend')
        .attr('transform', function(d, i) { return 'translate(0, ' + i * 20 + ')'; });

    legend.append('rect')
      .attr('x', width - 18)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', color)
    legend.append('text')
        .attr("x", width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(function(d) {return d; });
  });

  function type(d) {
    d.value = +d.value; //coerce to number
    return d;
  }

  function add_percent(d, n) {
    percent = +(d.split("%")[0])
    newPercent = percent + n
    return "" + newPercent + "%";
  }
};

ns.destroy = function(el) {};

module.exports = ns;

},{"./d3Axis.less":"/home/jedwards/rlbp2/src/d3Axis.less","./d3Bar.less":"/home/jedwards/rlbp2/src/d3Bar.less","./d3Legend.less":"/home/jedwards/rlbp2/src/d3Legend.less"}],"/home/jedwards/rlbp2/src/d3Table.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".markdown table{border-spacing:10px;border-collapse:separate}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}],"/home/jedwards/rlbp2/src/d3Tile.less":[function(require,module,exports){
(function() { var head = document.getElementsByTagName('head')[0]; var style = document.createElement('style'); style.type = 'text/css';var css = ".tile{shape-rendering:crispEdges}";if (style.styleSheet){ style.styleSheet.cssText = css; } else { style.appendChild(document.createTextNode(css)); } head.appendChild(style);}())
},{}]},{},["/home/jedwards/rlbp2/src/app.js"])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbWFya2VkL2xpYi9tYXJrZWQuanMiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvQmFyQ29udGFpbmVyLmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL0NhbnZhc0ZlYXRDb250YWluZXIuanMiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvQ2FudmFzSGVhdENvbnRhaW5lci5qcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9GZWF0dXJlQ29udGFpbmVyLmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL0dyb3VwQmFyQ29udGFpbmVyLmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL0hCYXJDb250YWluZXIuanMiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvSGVhdENvbnRhaW5lci5qcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9JbWFnZUNvbnRhaW5lci5qcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9MZXR0ZXJzQ29udGFpbmVyLmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL0xpbmVDb250YWluZXIuanMiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvTVhQQ29udGFpbmVyLmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL01hcmtkb3duQ29udGFpbmVyLmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL01hcmtkb3duRmlndXJlLmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL01hcmtkb3duRm9ybS5qcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9NYXJrZG93bkxpc3QuanMiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvU3RhY2tlZEJhckNvbnRhaW5lci5qcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9hcHAuanMiLCJzcmMvZDNBeGlzLmxlc3MiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvZDNCYXIuanMiLCJzcmMvZDNCYXIubGVzcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9kM0NhbnZhc0ZlYXQuanMiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvZDNDYW52YXNIZWF0LmpzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL2QzRmVhdHVyZS5qcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9kM0dyb3VwQmFyLmpzIiwic3JjL2QzSEF4aXMubGVzcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9kM0hCYXIuanMiLCJzcmMvZDNIQmFyLmxlc3MiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvZDNIZWF0LmpzIiwic3JjL2QzTGVnZW5kLmxlc3MiLCIvaG9tZS9qZWR3YXJkcy9ybGJwMi9zcmMvZDNMZXR0ZXJzLmpzIiwic3JjL2QzTGV0dGVycy5sZXNzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL2QzTGluZS5qcyIsInNyYy9kM0xpbmUubGVzcyIsIi9ob21lL2plZHdhcmRzL3JsYnAyL3NyYy9kM01YUC5qcyIsInNyYy9kM1Bvcy5sZXNzIiwiL2hvbWUvamVkd2FyZHMvcmxicDIvc3JjL2QzU3RhY2tlZEJhci5qcyIsInNyYy9kM1RhYmxlLmxlc3MiLCJzcmMvZDNUaWxlLmxlc3MiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4dkNBLGdDQUFnQztBQUNoQywwQkFBMEI7QUFDMUIsSUFBSSxLQUFLLEdBQUcsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDOztBQUVsQyxJQUFJLGtDQUFrQyw0QkFBQTtFQUNwQyxlQUFlLEVBQUUsV0FBVztJQUMxQixPQUFPO01BQ0wsS0FBSyxFQUFFLEdBQUc7TUFDVixNQUFNLEVBQUUsR0FBRztLQUNaLENBQUM7QUFDTixHQUFHOztF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SyxFQUFFLEtBQUssRUFBRTtFQUNyQyxTQUFTLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0tBQ3BDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDO0tBQ3BCLEtBQUssQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDdkMsS0FBSyxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0FBQ3pDOztFQUVFLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0dBQ3RCLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDO0tBQ2xCLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUM7S0FDekMsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQztHQUM3QyxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztHQUN2QyxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQztLQUNuQyxNQUFNLENBQUMsUUFBUSxDQUFDO0tBQ2hCLEtBQUssQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUM7S0FDekMsS0FBSyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQztBQUNoRCxLQUFLLElBQUksQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7O0VBRTlCLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0dBQ3RCLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDO0tBQ2xCLEtBQUssQ0FBQyxPQUFP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QUFNLEdBQUcsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRTs7RUFFckMsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO09BQ2hDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQztBQUNqQyxPQUFPLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDOztFQUVsQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN6QixDQUFDLENBQUM7O0FBRUYsRUFBRSxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUU7RUFDOUIsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDN0IsRUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQzs7RUFFN0IsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztFQUN2RCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzNELEVBQUUsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQzs7RUFFdkQsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN6RCxFQUFFLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7O0VBRXhELElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDekQsRUFBRSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDOztFQUV4RCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7RUFDekQsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDcEQsRUFBRSxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQzs7RUFFbEQsSUFBSSxTQUFTLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3hDLEVBQUUsSUFBSSxPQUFPLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztBQUN0SDs7RUFFRSxJQUFJLEdBQUcsR0FBRyxTQUFTLENBQUMsRUFBRSxDQUFDLEVBQUU7SUFDdkIsSUFBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ2IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRztNQUMzQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHO1FBQzNCLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7T0FDeEQ7QUFDUCxLQUFLOztJQUVELEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDO0lBQ3ZCLE9BQU8sR0FBRyxDQUFDO0FBQ2YsR0FBRzs7RUFFRCxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0VBQzlDLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDOUMsSUFBSSxL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QUU7TUFDdkIsQ0FBQyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsSUFBSSxFQUFFLEVBQUUsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdEYsS0FBSyxDQUFDLENBQUM7QUFDUDs7SUFFSSxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUQsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsRUFBRSxFQUFFLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsTSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDOztBQUUvRyxJQUFJLElBQUksS0FBSyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDOztJQUUzQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztPQUNkLElBQUksQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDO09BQ3ZCLElBQUksQ0FBQyxXQUFXLEVBQUUsZUFBZSxHQUFHLE1BQU0sR0FBRyxHQUFHLENBQUM7QUFDeEQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDOztJQUVoQixLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztPQUNkLElBQUksQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDO09BQ3ZCLElBQUksQ0FBQyxXQUFXLEVBQUUsWUFBWSxHQUFHLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQztPQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztPQUNaLE1BQU0sQ0FBQyxNQUFNLENBQUM7T0FDZCxJQUFJLENBQUMsV0FBVyxFQUFFLGFBQWEsQ0FBQztPQUNoQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztPQUNaLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDO09BQ25CLEtBQUssQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDO0FBQ2xDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQzVCO0FBQ0E7O0lBRUksSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7WUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQztZQUNWLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUM7WUFDbkIsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUM7QUFDbEMsWUFBWSxJQUFJLENBQUMsV0FBVyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxZQUFZLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDOztJQUU5RixLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQztTQUNsQixJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ2xDLEtBQUssRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7U0FDdEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDO1NBQ3BDLElBQUksQ0FBQyxHQUFHLEVBQUUsU0FBUyxDQUFDLEVBQUUsRUFBRSxPQUFPLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztTQUNwRCxJQUFJLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7U0FDcEQsSUFBSSxDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsRUFBRSxFQUFFLE9BQU8sTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUMzRSxTQUFTLEtBQUssQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDOUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLElBQUksSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUM7O1NBRWxDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDNUIsS0FBSyxFQUFFLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQztTQUNuQixJQUFJLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQztBQUNoQyxTQUFTLElBQUksQ0FBQyxXQUFXLEVBQUUsU0FBUyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsT0FBTyxlQUFlLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7O1FBRTlFLElBQUksYUFBYSxHQUFHLEVBQUUsQ0FBQztJQUMzQixNQUFNLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztPQUNsQixJQUFJLENBQUMsR0FBRyxFQUFFLGFBQWEsR0FBRyxLQUFLLEdBQUcsRUFBRSxDQUFDO09BQ3JDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO09BQ2pCLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO09BQ2xCLEtBQUssQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDO0lBQ3ZCLE1BQU0sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDO1NBQ2hCLElBQUksQ0FBQyxHQUFHLEVBQUUsYUFBYSxHQUFHLEtBQUssR0FBRyxFQUFFLENBQUM7U0FDckMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7U0FDWixJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQztTQUNuQixLQUFLLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQztTQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN4QyxHQUFHLENBQUMsQ0FBQzs7RUFFSCxTQUFTLElBQUksQ0FBQyxDQUFDLEVBQUU7SUFDZixDQUFDLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztJQUNuQixPQUFPLENBQUMsQ0FBQztBQUNiLEdBQUc7O0VBRUQsU0FBUyxXQUFXLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtJQUN6QixPQUFPLEdBQUcsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVCLFVBQVUsR0FBRyxPQUFPLEdBQUcsQ0FBQztJQUN4QixPQUFPLEVBQUUsR0FBRyxVQUFVLEdBQUcsR0FBRyxDQUFDO0dBQzlCO0FBQ0gsQ0FBQyxDQUFDOztBQUVGLEVBQUUsQ0FBQyxPQUFPLEdBQUcsU0FBUyxFQUFFLEVBQUUsRUFBRSxDQUFDOztBQUU3QixNQUFNLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQzs7O0FDMUtwQjs7QUNBQSwwQkFBMEI7O0FBRTFCLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixPQUFPLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzs7QUFFMUIsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDOztBQUVaLEVBQUUsQ0FBQyxPQUFPLEdBQUcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7O0FBRXhELEVBQUUsQ0FBQyxNQUFNLEdBQUcsU0FBUyxLQUFLLEVBQUU7RUFDMUIsT0FBTyxLQUFLLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0FBQzlELENBQUM7O0FBRUQsRUFBRSxDQUFDLE9BQU8sR0FBRyxTQUFTLEtBQUssRUFBRTtFQUMzQixPQUFPLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7QUFDL0QsQ0FBQzs7QUFFRCxFQUFFLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUU7RUFDckMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO09BQ3RCLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQztPQUMxQixJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQyxLQUFLLENBQUM7T0FDM0IsTUFBTSxDQUFDLEdBQUcsQ0FBQztPQUNYLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDO0FBQzdCLE9BQU8sSUFBSSxDQUFDLFdBQVcsRUFBRSxZQUFZLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDOztFQUV4RixJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUN6QixDQUFDOztBQUVELEVBQUUsQ0FBQyxLQUFLLEdBQUcsU0FBUyxNQUFNLEVBQUU7RUFDMUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUU7ZUFDUixLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztlQUNmLE1BQU0sQ0FBQyxRQUFRLENBQUM7QUFDL0IsZUFBZSxLQUFLLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxDQUFDOztFQUU1QixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRTtlQUNSLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzlCLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztFQUU1QixPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQ0FBQzs7QUFFRCxFQUFFLENBQUMsT0FBTyxHQUFHLFNBQVMsS0FBSyxFQUFFO0VBQzNCLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzdCLEVBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7O0VBRTdCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFO1dBQ2hCLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQzNCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO0FBQzVCLFdBQVcsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDOztFQUUxQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQ0FBQzs7QUFFRCxFQUFFLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRTtFQUM5QixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQy9CLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDakMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNuQyxFQUFFLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7O0VBRTlCLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxLQUFLLEVBQUUsSUFBSSxFQUFFO0lBQzdDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4RSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQzs7QUFFN0QsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQzs7SUFFM0MsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUM7T0FDZCxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQztPQUN4QixJQUFJLENBQUMsV0FBVyxFQUFFLGVBQWUsR0FBRyxNQUFNLEdBQUcsR0FBRyxDQUFDO09BQ2pELElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO09BQ1osTUFBTSxDQUFDLE1BQU0sQ0FBQztPQUNkLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO09BQ1osSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7T0FDbkIsS0FBSyxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUM7QUFDckMsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7O0lBRXJCLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDO09BQ2QsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7QUFDL0IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BCOztJQUVJLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDO1lBQzFCLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDVixLQUFLLEVBQUUsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDO1lBQ25CLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDO0FBQ2pDLFlBQVksSUFBSSxDQUFDLFdBQVcsRUFBRSxTQUFTLENBQUMsRUFBRSxFQUFFLE9BQU8sY0FBYyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQzs7SUFFM0YsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7U0FDYixJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7QUFDakUsU0FBUyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQzs7SUFFMUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7U0FDYixJQUFJLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEVBQUUsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDO1NBQ3hELElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDbkMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7U0FDbkIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JFLEdBQUcsQ0FBQyxDQUFDOztFQUVILFNBQVMsSUFBSSxDQUFDLENBQUMsRUFBRTtJQUNmLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO0lBQ25CLE9BQU8sQ0FBQyxDQUFDO0FBQ2IsR0FBRzs7RUFFRCxTQUFTLFdBQVcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFO0lBQ3pCLE9BQU8sR0FBRyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDNUIsVUFBVSxHQUFHLE9BQU8sR0FBRyxDQUFDO0lBQ3hCLE9BQU8sRUFBRSxHQUFHLFVBQVUsR0FBRyxHQUFHLENBQUM7R0FDOUI7QUFDSCxDQUFDLENBQUM7O0FBRUYsRUFBRSxDQUFDLE9BQU8sR0FBRyxTQUFTLEVBQUUsRUFBRSxFQUFFLENBQUM7O0FBRTdCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDOzs7QUMvR3BCOztBQ0FBLDBCQUEwQjs7QUFFMUIsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0FBQ3hCLE9BQU8sQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUN6QixPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7O0FBRXpCLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQzs7QUFFWixFQUFFLENBQUMsT0FBTyxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDOztBQUV4RCxFQUFFLENBQUMsTUFBTSxHQUFHLFNBQVMsS0FBSyxFQUFFO0VBQzFCLE9BQU8sS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztBQUM5RCxDQUFDOztBQUVELEVBQUUsQ0FBQyxPQUFPLEdBQUcsU0FBUyxLQUFLLEVBQUU7RUFDM0IsT0FBTyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0FBQy9ELENBQUM7O0FBRUQsRUFBRSxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFOztFQUVyQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7S0FDeEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsS0FBSyxDQUFDO0tBQzFCLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQztLQUM1QixNQUFNLENBQUMsR0FBRyxDQUFDO0tBQ1gsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUM7QUFDM0IsS0FBSyxJQUFJLENBQUMsV0FBVyxFQUFFLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7O0VBRXRGLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pCLENBQUM7O0FBRUQsRUFBRSxDQUFDLEtBQUssR0FBRyxTQUFTLE1BQU0sRUFBRTtFQUMxQixJQUFJLFVBQVUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztFQUN6QyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRTtlQUNSLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2VBQ2YsTUFBTSxDQUFDLFFBQVEsQ0FBQztlQUNoQixLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDbEMsZUFBZSxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7O0VBRXBDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFO2VBQ1IsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDOUIsZUFBZSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7O0VBRTVCLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFDOztBQUVELEVBQUUsQ0FBQyxPQUFPLEdBQUcsU0FBUyxLQUFLLEVBQUU7RUFDM0IsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDN0IsRUFBRSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQzs7RUFFN0IsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUU7V0FDaEIsS0FBSyxDQUFDLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7RUFDdkMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUU7V0FDaEIsS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDNUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7QUFDekIsV0FBVyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQzs7RUFFM0IsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDNUIsQ0FBQzs7QUFFRCxFQUFFLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRTtFQUM5QixJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0VBQy9CLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7RUFDakMsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztFQUNqQyxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0VBQzlCLElBQUksU0FBUyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssQ0FBQztFQUNqRCxJQUFJLEtBQUssR0FBRyxLQUFLO0FBQ25CLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQzs7RUFFaEIsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxVQUFVLEtBQUssRUFBRSxJQUFJLEVBQUU7QUFDakQsSUFBSSxJQUFJLEtBQUssRUFBRSxNQUFNLEtBQUssQ0FBQzs7SUFFdkIsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNoRSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3RFLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDOztJQUVwRSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDM0UsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7O0FBRTNFLElBQUksSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDL0M7QUFDQTtBQUNBOztJQUVJLElB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QUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pCLENBQUM7O0FBRUQsRUFBRSxDQUFDLEtBQUssR0FBRyxTQUFTLE1BQU0sRUFBRTtFQUMxQixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRTtlQUNSLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzlCLGVBQWUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDOztFQUU5QixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRTtlQUNSLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQzlCLGVBQWUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztFQUU1QixPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEIsQ0FBQzs7QUFFRCxFQUFFLENBQUMsT0FBTyxHQUFHLFNBQVMsS0FBSyxFQUFFO0VBQzNCLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzdCLEVBQUUsTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7O0VBRTdCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFO0FBQzNCLFdBQVcsS0FBSyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7O0VBRTVCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO0FBQ3pCLFdBQVcsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7O0VBRTNCLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN0QixDQUFDOztBQUVELEVBQUUsQ0FBQyxNQUFNLEdBQUcsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFO0VBQzlCLElBQUksS0FB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RSxLQUFLLEdBQUcsRUFBRSxDQUFDO1NBQ3JCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1NBQ1osSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7U0FDbkIsS0FBSyxDQUFDLGFBQWEsRUFBRSxLQUFLLENBQUM7U0FDM0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDeEMsR0FBRyxDQUFDLENBQUM7O0VBRUgsU0FBUyxJQUFJLENBQUMsQ0FBQyxFQUFFO0lBQ2YsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7SUFDbkIsT0FBTyxDQUFDLENBQUM7QUFDYixHQUFHOztFQUVELFNBQVMsV0FBVyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7SUFDekIsT0FBTyxHQUFHLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM1QixVQUFVLEdBQUcsT0FBTyxHQUFHLENBQUM7SUFDeEIsT0FBTyxFQUFFLEdBQUcsVUFBVSxHQUFHLEdBQUcsQ0FBQztHQUM5QjtBQUNILENBQUMsQ0FBQzs7QUFFRixFQUFFLENBQUMsT0FBTyxHQUFHLFNBQVMsRUFBRSxFQUFFLEVBQUUsQ0FBQzs7QUFFN0IsTUFBTSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7OztBQ3ZKcEI7O0FDQUEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBtYXJrZWQgLSBhIG1hcmtkb3duIHBhcnNlclxuICogQ29weXJpZ2h0IChjKSAyMDExLTIwMTQsIENocmlzdG9waGVyIEplZmZyZXkuIChNSVQgTGljZW5zZWQpXG4gKiBodHRwczovL2dpdGh1Yi5jb20vY2hqai9tYXJrZWRcbiAqL1xuXG47KGZ1bmN0aW9uKCkge1xuXG4vKipcbiAqIEJsb2NrLUxldmVsIEdyYW1tYXJcbiAqL1xuXG52YXIgYmxvY2sgPSB7XG4gIG5ld2xpbmU6IC9eXFxuKy8sXG4gIGNvZGU6IC9eKCB7NH1bXlxcbl0rXFxuKikrLyxcbiAgZmVuY2VzOiBub29wLFxuICBocjogL14oICpbLSpfXSl7Myx9ICooPzpcXG4rfCQpLyxcbiAgaGVhZGluZzogL14gKigjezEsNn0pICooW15cXG5dKz8pICojKiAqKD86XFxuK3wkKS8sXG4gIG5wdGFibGU6IG5vb3AsXG4gIGxoZWFkaW5nOiAvXihbXlxcbl0rKVxcbiAqKD18LSl7Mix9ICooPzpcXG4rfCQpLyxcbiAgYmxvY2txdW90ZTogL14oICo+W15cXG5dKyhcXG4oPyFkZWYpW15cXG5dKykqXFxuKikrLyxcbiAgbGlzdDogL14oICopKGJ1bGwpIFtcXHNcXFNdKz8oPzpocnxkZWZ8XFxuezIsfSg/ISApKD8hXFwxYnVsbCApXFxuKnxcXHMqJCkvLFxuICBodG1sOiAvXiAqKD86Y29tbWVudCAqKD86XFxufFxccyokKXxjbG9zZWQgKig/OlxcbnsyLH18XFxzKiQpfGNsb3NpbmcgKig/OlxcbnsyLH18XFxzKiQpKS8sXG4gIGRlZjogL14gKlxcWyhbXlxcXV0rKVxcXTogKjw/KFteXFxzPl0rKT4/KD86ICtbXCIoXShbXlxcbl0rKVtcIildKT8gKig/Olxcbit8JCkvLFxuICB0YWJsZTogbm9vcCxcbiAgcGFyYWdyYXBoOiAvXigoPzpbXlxcbl0rXFxuPyg/IWhyfGhlYWRpbmd8bGhlYWRpbmd8YmxvY2txdW90ZXx0YWd8ZGVmKSkrKVxcbiovLFxuICB0ZXh0OiAvXlteXFxuXSsvXG59O1xuXG5ibG9jay5idWxsZXQgPSAvKD86WyorLV18XFxkK1xcLikvO1xuYmxvY2suaXRlbSA9IC9eKCAqKShidWxsKSBbXlxcbl0qKD86XFxuKD8hXFwxYnVsbCApW15cXG5dKikqLztcbmJsb2NrLml0ZW0gPSByZXBsYWNlKGJsb2NrLml0ZW0sICdnbScpXG4gICgvYnVsbC9nLCBibG9jay5idWxsZXQpXG4gICgpO1xuXG5ibG9jay5saXN0ID0gcmVwbGFjZShibG9jay5saXN0KVxuICAoL2J1bGwvZywgYmxvY2suYnVsbGV0KVxuICAoJ2hyJywgJ1xcXFxuKyg/PVxcXFwxPyg/OlstKl9dICopezMsfSg/OlxcXFxuK3wkKSknKVxuICAoJ2RlZicsICdcXFxcbisoPz0nICsgYmxvY2suZGVmLnNvdXJjZSArICcpJylcbiAgKCk7XG5cbmJsb2NrLmJsb2NrcXVvdGUgPSByZXBsYWNlKGJsb2NrLmJsb2NrcXVvdGUpXG4gICgnZGVmJywgYmxvY2suZGVmKVxuICAoKTtcblxuYmxvY2suX3RhZyA9ICcoPyEoPzonXG4gICsgJ2F8ZW18c3Ryb25nfHNtYWxsfHN8Y2l0ZXxxfGRmbnxhYmJyfGRhdGF8dGltZXxjb2RlJ1xuICArICd8dmFyfHNhbXB8a2JkfHN1YnxzdXB8aXxifHV8bWFya3xydWJ5fHJ0fHJwfGJkaXxiZG8nXG4gICsgJ3xzcGFufGJyfHdicnxpbnN8ZGVsfGltZylcXFxcYilcXFxcdysoPyE6L3xbXlxcXFx3XFxcXHNAXSpAKVxcXFxiJztcblxuYmxvY2suaHRtbCA9IHJlcGxhY2UoYmxvY2suaHRtbClcbiAgKCdjb21tZW50JywgLzwhLS1bXFxzXFxTXSo/LS0+LylcbiAgKCdjbG9zZWQnLCAvPCh0YWcpW1xcc1xcU10rPzxcXC9cXDE+LylcbiAgKCdjbG9zaW5nJywgLzx0YWcoPzpcIlteXCJdKlwifCdbXiddKid8W14nXCI+XSkqPz4vKVxuICAoL3RhZy9nLCBibG9jay5fdGFnKVxuICAoKTtcblxuYmxvY2sucGFyYWdyYXBoID0gcmVwbGFjZShibG9jay5wYXJhZ3JhcGgpXG4gICgnaHInLCBibG9jay5ocilcbiAgKCdoZWFkaW5nJywgYmxvY2suaGVhZGluZylcbiAgKCdsaGVhZGluZycsIGJsb2NrLmxoZWFkaW5nKVxuICAoJ2Jsb2NrcXVvdGUnLCBibG9jay5ibG9ja3F1b3RlKVxuICAoJ3RhZycsICc8JyArIGJsb2NrLl90YWcpXG4gICgnZGVmJywgYmxvY2suZGVmKVxuICAoKTtcblxuLyoqXG4gKiBOb3JtYWwgQmxvY2sgR3JhbW1hclxuICovXG5cbmJsb2NrLm5vcm1hbCA9IG1lcmdlKHt9LCBibG9jayk7XG5cbi8qKlxuICogR0ZNIEJsb2NrIEdyYW1tYXJcbiAqL1xuXG5ibG9jay5nZm0gPSBtZXJnZSh7fSwgYmxvY2subm9ybWFsLCB7XG4gIGZlbmNlczogL14gKihgezMsfXx+ezMsfSkgKihcXFMrKT8gKlxcbihbXFxzXFxTXSs/KVxccypcXDEgKig/Olxcbit8JCkvLFxuICBwYXJhZ3JhcGg6IC9eL1xufSk7XG5cbmJsb2NrLmdmbS5wYXJhZ3JhcGggPSByZXBsYWNlKGJsb2NrLnBhcmFncmFwaClcbiAgKCcoPyEnLCAnKD8hJ1xuICAgICsgYmxvY2suZ2ZtLmZlbmNlcy5zb3VyY2UucmVwbGFjZSgnXFxcXDEnLCAnXFxcXDInKSArICd8J1xuICAgICsgYmxvY2subGlzdC5zb3VyY2UucmVwbGFjZSgnXFxcXDEnLCAnXFxcXDMnKSArICd8JylcbiAgKCk7XG5cbi8qKlxuICogR0ZNICsgVGFibGVzIEJsb2NrIEdyYW1tYXJcbiAqL1xuXG5ibG9jay50YWJsZXMgPSBtZXJnZSh7fSwgYmxvY2suZ2ZtLCB7XG4gIG5wdGFibGU6IC9eICooXFxTLipcXHwuKilcXG4gKihbLTpdKyAqXFx8Wy18IDpdKilcXG4oKD86LipcXHwuKig/OlxcbnwkKSkqKVxcbiovLFxuICB0YWJsZTogL14gKlxcfCguKylcXG4gKlxcfCggKlstOl0rWy18IDpdKilcXG4oKD86ICpcXHwuKig/OlxcbnwkKSkqKVxcbiovXG59KTtcblxuLyoqXG4gKiBCbG9jayBMZXhlclxuICovXG5cbmZ1bmN0aW9uIExleGVyKG9wdGlvbnMpIHtcbiAgdGhpcy50b2tlbnMgPSBbXTtcbiAgdGhpcy50b2tlbnMubGlua3MgPSB7fTtcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCBtYXJrZWQuZGVmYXVsdHM7XG4gIHRoaXMucnVsZXMgPSBibG9jay5ub3JtYWw7XG5cbiAgaWYgKHRoaXMub3B0aW9ucy5nZm0pIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnRhYmxlcykge1xuICAgICAgdGhpcy5ydWxlcyA9IGJsb2NrLnRhYmxlcztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ydWxlcyA9IGJsb2NrLmdmbTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBFeHBvc2UgQmxvY2sgUnVsZXNcbiAqL1xuXG5MZXhlci5ydWxlcyA9IGJsb2NrO1xuXG4vKipcbiAqIFN0YXRpYyBMZXggTWV0aG9kXG4gKi9cblxuTGV4ZXIubGV4ID0gZnVuY3Rpb24oc3JjLCBvcHRpb25zKSB7XG4gIHZhciBsZXhlciA9IG5ldyBMZXhlcihvcHRpb25zKTtcbiAgcmV0dXJuIGxleGVyLmxleChzcmMpO1xufTtcblxuLyoqXG4gKiBQcmVwcm9jZXNzaW5nXG4gKi9cblxuTGV4ZXIucHJvdG90eXBlLmxleCA9IGZ1bmN0aW9uKHNyYykge1xuICBzcmMgPSBzcmNcbiAgICAucmVwbGFjZSgvXFxyXFxufFxcci9nLCAnXFxuJylcbiAgICAucmVwbGFjZSgvXFx0L2csICcgICAgJylcbiAgICAucmVwbGFjZSgvXFx1MDBhMC9nLCAnICcpXG4gICAgLnJlcGxhY2UoL1xcdTI0MjQvZywgJ1xcbicpO1xuXG4gIHJldHVybiB0aGlzLnRva2VuKHNyYywgdHJ1ZSk7XG59O1xuXG4vKipcbiAqIExleGluZ1xuICovXG5cbkxleGVyLnByb3RvdHlwZS50b2tlbiA9IGZ1bmN0aW9uKHNyYywgdG9wLCBicSkge1xuICB2YXIgc3JjID0gc3JjLnJlcGxhY2UoL14gKyQvZ20sICcnKVxuICAgICwgbmV4dFxuICAgICwgbG9vc2VcbiAgICAsIGNhcFxuICAgICwgYnVsbFxuICAgICwgYlxuICAgICwgaXRlbVxuICAgICwgc3BhY2VcbiAgICAsIGlcbiAgICAsIGw7XG5cbiAgd2hpbGUgKHNyYykge1xuICAgIC8vIG5ld2xpbmVcbiAgICBpZiAoY2FwID0gdGhpcy5ydWxlcy5uZXdsaW5lLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIGlmIChjYXBbMF0ubGVuZ3RoID4gMSkge1xuICAgICAgICB0aGlzLnRva2Vucy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnc3BhY2UnXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGNvZGVcbiAgICBpZiAoY2FwID0gdGhpcy5ydWxlcy5jb2RlLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIGNhcCA9IGNhcFswXS5yZXBsYWNlKC9eIHs0fS9nbSwgJycpO1xuICAgICAgdGhpcy50b2tlbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdjb2RlJyxcbiAgICAgICAgdGV4dDogIXRoaXMub3B0aW9ucy5wZWRhbnRpY1xuICAgICAgICAgID8gY2FwLnJlcGxhY2UoL1xcbiskLywgJycpXG4gICAgICAgICAgOiBjYXBcbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gZmVuY2VzIChnZm0pXG4gICAgaWYgKGNhcCA9IHRoaXMucnVsZXMuZmVuY2VzLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIHRoaXMudG9rZW5zLnB1c2goe1xuICAgICAgICB0eXBlOiAnY29kZScsXG4gICAgICAgIGxhbmc6IGNhcFsyXSxcbiAgICAgICAgdGV4dDogY2FwWzNdXG4gICAgICB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIGhlYWRpbmdcbiAgICBpZiAoY2FwID0gdGhpcy5ydWxlcy5oZWFkaW5nLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIHRoaXMudG9rZW5zLnB1c2goe1xuICAgICAgICB0eXBlOiAnaGVhZGluZycsXG4gICAgICAgIGRlcHRoOiBjYXBbMV0ubGVuZ3RoLFxuICAgICAgICB0ZXh0OiBjYXBbMl1cbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gdGFibGUgbm8gbGVhZGluZyBwaXBlIChnZm0pXG4gICAgaWYgKHRvcCAmJiAoY2FwID0gdGhpcy5ydWxlcy5ucHRhYmxlLmV4ZWMoc3JjKSkpIHtcbiAgICAgIHNyYyA9IHNyYy5zdWJzdHJpbmcoY2FwWzBdLmxlbmd0aCk7XG5cbiAgICAgIGl0ZW0gPSB7XG4gICAgICAgIHR5cGU6ICd0YWJsZScsXG4gICAgICAgIGhlYWRlcjogY2FwWzFdLnJlcGxhY2UoL14gKnwgKlxcfCAqJC9nLCAnJykuc3BsaXQoLyAqXFx8ICovKSxcbiAgICAgICAgYWxpZ246IGNhcFsyXS5yZXBsYWNlKC9eICp8XFx8ICokL2csICcnKS5zcGxpdCgvICpcXHwgKi8pLFxuICAgICAgICBjZWxsczogY2FwWzNdLnJlcGxhY2UoL1xcbiQvLCAnJykuc3BsaXQoJ1xcbicpXG4gICAgICB9O1xuXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgaXRlbS5hbGlnbi5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoL14gKi0rOiAqJC8udGVzdChpdGVtLmFsaWduW2ldKSkge1xuICAgICAgICAgIGl0ZW0uYWxpZ25baV0gPSAncmlnaHQnO1xuICAgICAgICB9IGVsc2UgaWYgKC9eICo6LSs6ICokLy50ZXN0KGl0ZW0uYWxpZ25baV0pKSB7XG4gICAgICAgICAgaXRlbS5hbGlnbltpXSA9ICdjZW50ZXInO1xuICAgICAgICB9IGVsc2UgaWYgKC9eICo6LSsgKiQvLnRlc3QoaXRlbS5hbGlnbltpXSkpIHtcbiAgICAgICAgICBpdGVtLmFsaWduW2ldID0gJ2xlZnQnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGl0ZW0uYWxpZ25baV0gPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBpdGVtLmNlbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZW0uY2VsbHNbaV0gPSBpdGVtLmNlbGxzW2ldLnNwbGl0KC8gKlxcfCAqLyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudG9rZW5zLnB1c2goaXRlbSk7XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIGxoZWFkaW5nXG4gICAgaWYgKGNhcCA9IHRoaXMucnVsZXMubGhlYWRpbmcuZXhlYyhzcmMpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgdGhpcy50b2tlbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdoZWFkaW5nJyxcbiAgICAgICAgZGVwdGg6IGNhcFsyXSA9PT0gJz0nID8gMSA6IDIsXG4gICAgICAgIHRleHQ6IGNhcFsxXVxuICAgICAgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBoclxuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLmhyLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIHRoaXMudG9rZW5zLnB1c2goe1xuICAgICAgICB0eXBlOiAnaHInXG4gICAgICB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIGJsb2NrcXVvdGVcbiAgICBpZiAoY2FwID0gdGhpcy5ydWxlcy5ibG9ja3F1b3RlLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcblxuICAgICAgdGhpcy50b2tlbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdibG9ja3F1b3RlX3N0YXJ0J1xuICAgICAgfSk7XG5cbiAgICAgIGNhcCA9IGNhcFswXS5yZXBsYWNlKC9eICo+ID8vZ20sICcnKTtcblxuICAgICAgLy8gUGFzcyBgdG9wYCB0byBrZWVwIHRoZSBjdXJyZW50XG4gICAgICAvLyBcInRvcGxldmVsXCIgc3RhdGUuIFRoaXMgaXMgZXhhY3RseVxuICAgICAgLy8gaG93IG1hcmtkb3duLnBsIHdvcmtzLlxuICAgICAgdGhpcy50b2tlbihjYXAsIHRvcCwgdHJ1ZSk7XG5cbiAgICAgIHRoaXMudG9rZW5zLnB1c2goe1xuICAgICAgICB0eXBlOiAnYmxvY2txdW90ZV9lbmQnXG4gICAgICB9KTtcblxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gbGlzdFxuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLmxpc3QuZXhlYyhzcmMpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgYnVsbCA9IGNhcFsyXTtcblxuICAgICAgdGhpcy50b2tlbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICdsaXN0X3N0YXJ0JyxcbiAgICAgICAgb3JkZXJlZDogYnVsbC5sZW5ndGggPiAxXG4gICAgICB9KTtcblxuICAgICAgLy8gR2V0IGVhY2ggdG9wLWxldmVsIGl0ZW0uXG4gICAgICBjYXAgPSBjYXBbMF0ubWF0Y2godGhpcy5ydWxlcy5pdGVtKTtcblxuICAgICAgbmV4dCA9IGZhbHNlO1xuICAgICAgbCA9IGNhcC5sZW5ndGg7XG4gICAgICBpID0gMDtcblxuICAgICAgZm9yICg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgaXRlbSA9IGNhcFtpXTtcblxuICAgICAgICAvLyBSZW1vdmUgdGhlIGxpc3QgaXRlbSdzIGJ1bGxldFxuICAgICAgICAvLyBzbyBpdCBpcyBzZWVuIGFzIHRoZSBuZXh0IHRva2VuLlxuICAgICAgICBzcGFjZSA9IGl0ZW0ubGVuZ3RoO1xuICAgICAgICBpdGVtID0gaXRlbS5yZXBsYWNlKC9eICooWyorLV18XFxkK1xcLikgKy8sICcnKTtcblxuICAgICAgICAvLyBPdXRkZW50IHdoYXRldmVyIHRoZVxuICAgICAgICAvLyBsaXN0IGl0ZW0gY29udGFpbnMuIEhhY2t5LlxuICAgICAgICBpZiAofml0ZW0uaW5kZXhPZignXFxuICcpKSB7XG4gICAgICAgICAgc3BhY2UgLT0gaXRlbS5sZW5ndGg7XG4gICAgICAgICAgaXRlbSA9ICF0aGlzLm9wdGlvbnMucGVkYW50aWNcbiAgICAgICAgICAgID8gaXRlbS5yZXBsYWNlKG5ldyBSZWdFeHAoJ14gezEsJyArIHNwYWNlICsgJ30nLCAnZ20nKSwgJycpXG4gICAgICAgICAgICA6IGl0ZW0ucmVwbGFjZSgvXiB7MSw0fS9nbSwgJycpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGV0ZXJtaW5lIHdoZXRoZXIgdGhlIG5leHQgbGlzdCBpdGVtIGJlbG9uZ3MgaGVyZS5cbiAgICAgICAgLy8gQmFja3BlZGFsIGlmIGl0IGRvZXMgbm90IGJlbG9uZyBpbiB0aGlzIGxpc3QuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc21hcnRMaXN0cyAmJiBpICE9PSBsIC0gMSkge1xuICAgICAgICAgIGIgPSBibG9jay5idWxsZXQuZXhlYyhjYXBbaSArIDFdKVswXTtcbiAgICAgICAgICBpZiAoYnVsbCAhPT0gYiAmJiAhKGJ1bGwubGVuZ3RoID4gMSAmJiBiLmxlbmd0aCA+IDEpKSB7XG4gICAgICAgICAgICBzcmMgPSBjYXAuc2xpY2UoaSArIDEpLmpvaW4oJ1xcbicpICsgc3JjO1xuICAgICAgICAgICAgaSA9IGwgLSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIERldGVybWluZSB3aGV0aGVyIGl0ZW0gaXMgbG9vc2Ugb3Igbm90LlxuICAgICAgICAvLyBVc2U6IC8oXnxcXG4pKD8hIClbXlxcbl0rXFxuXFxuKD8hXFxzKiQpL1xuICAgICAgICAvLyBmb3IgZGlzY291bnQgYmVoYXZpb3IuXG4gICAgICAgIGxvb3NlID0gbmV4dCB8fCAvXFxuXFxuKD8hXFxzKiQpLy50ZXN0KGl0ZW0pO1xuICAgICAgICBpZiAoaSAhPT0gbCAtIDEpIHtcbiAgICAgICAgICBuZXh0ID0gaXRlbS5jaGFyQXQoaXRlbS5sZW5ndGggLSAxKSA9PT0gJ1xcbic7XG4gICAgICAgICAgaWYgKCFsb29zZSkgbG9vc2UgPSBuZXh0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy50b2tlbnMucHVzaCh7XG4gICAgICAgICAgdHlwZTogbG9vc2VcbiAgICAgICAgICAgID8gJ2xvb3NlX2l0ZW1fc3RhcnQnXG4gICAgICAgICAgICA6ICdsaXN0X2l0ZW1fc3RhcnQnXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFJlY3Vyc2UuXG4gICAgICAgIHRoaXMudG9rZW4oaXRlbSwgZmFsc2UsIGJxKTtcblxuICAgICAgICB0aGlzLnRva2Vucy5wdXNoKHtcbiAgICAgICAgICB0eXBlOiAnbGlzdF9pdGVtX2VuZCdcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudG9rZW5zLnB1c2goe1xuICAgICAgICB0eXBlOiAnbGlzdF9lbmQnXG4gICAgICB9KTtcblxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gaHRtbFxuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLmh0bWwuZXhlYyhzcmMpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgdGhpcy50b2tlbnMucHVzaCh7XG4gICAgICAgIHR5cGU6IHRoaXMub3B0aW9ucy5zYW5pdGl6ZVxuICAgICAgICAgID8gJ3BhcmFncmFwaCdcbiAgICAgICAgICA6ICdodG1sJyxcbiAgICAgICAgcHJlOiBjYXBbMV0gPT09ICdwcmUnIHx8IGNhcFsxXSA9PT0gJ3NjcmlwdCcgfHwgY2FwWzFdID09PSAnc3R5bGUnLFxuICAgICAgICB0ZXh0OiBjYXBbMF1cbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gZGVmXG4gICAgaWYgKCghYnEgJiYgdG9wKSAmJiAoY2FwID0gdGhpcy5ydWxlcy5kZWYuZXhlYyhzcmMpKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIHRoaXMudG9rZW5zLmxpbmtzW2NhcFsxXS50b0xvd2VyQ2FzZSgpXSA9IHtcbiAgICAgICAgaHJlZjogY2FwWzJdLFxuICAgICAgICB0aXRsZTogY2FwWzNdXG4gICAgICB9O1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gdGFibGUgKGdmbSlcbiAgICBpZiAodG9wICYmIChjYXAgPSB0aGlzLnJ1bGVzLnRhYmxlLmV4ZWMoc3JjKSkpIHtcbiAgICAgIHNyYyA9IHNyYy5zdWJzdHJpbmcoY2FwWzBdLmxlbmd0aCk7XG5cbiAgICAgIGl0ZW0gPSB7XG4gICAgICAgIHR5cGU6ICd0YWJsZScsXG4gICAgICAgIGhlYWRlcjogY2FwWzFdLnJlcGxhY2UoL14gKnwgKlxcfCAqJC9nLCAnJykuc3BsaXQoLyAqXFx8ICovKSxcbiAgICAgICAgYWxpZ246IGNhcFsyXS5yZXBsYWNlKC9eICp8XFx8ICokL2csICcnKS5zcGxpdCgvICpcXHwgKi8pLFxuICAgICAgICBjZWxsczogY2FwWzNdLnJlcGxhY2UoLyg/OiAqXFx8ICopP1xcbiQvLCAnJykuc3BsaXQoJ1xcbicpXG4gICAgICB9O1xuXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgaXRlbS5hbGlnbi5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoL14gKi0rOiAqJC8udGVzdChpdGVtLmFsaWduW2ldKSkge1xuICAgICAgICAgIGl0ZW0uYWxpZ25baV0gPSAncmlnaHQnO1xuICAgICAgICB9IGVsc2UgaWYgKC9eICo6LSs6ICokLy50ZXN0KGl0ZW0uYWxpZ25baV0pKSB7XG4gICAgICAgICAgaXRlbS5hbGlnbltpXSA9ICdjZW50ZXInO1xuICAgICAgICB9IGVsc2UgaWYgKC9eICo6LSsgKiQvLnRlc3QoaXRlbS5hbGlnbltpXSkpIHtcbiAgICAgICAgICBpdGVtLmFsaWduW2ldID0gJ2xlZnQnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGl0ZW0uYWxpZ25baV0gPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBpdGVtLmNlbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGl0ZW0uY2VsbHNbaV0gPSBpdGVtLmNlbGxzW2ldXG4gICAgICAgICAgLnJlcGxhY2UoL14gKlxcfCAqfCAqXFx8ICokL2csICcnKVxuICAgICAgICAgIC5zcGxpdCgvICpcXHwgKi8pO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnRva2Vucy5wdXNoKGl0ZW0pO1xuXG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB0b3AtbGV2ZWwgcGFyYWdyYXBoXG4gICAgaWYgKHRvcCAmJiAoY2FwID0gdGhpcy5ydWxlcy5wYXJhZ3JhcGguZXhlYyhzcmMpKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIHRoaXMudG9rZW5zLnB1c2goe1xuICAgICAgICB0eXBlOiAncGFyYWdyYXBoJyxcbiAgICAgICAgdGV4dDogY2FwWzFdLmNoYXJBdChjYXBbMV0ubGVuZ3RoIC0gMSkgPT09ICdcXG4nXG4gICAgICAgICAgPyBjYXBbMV0uc2xpY2UoMCwgLTEpXG4gICAgICAgICAgOiBjYXBbMV1cbiAgICAgIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gdGV4dFxuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLnRleHQuZXhlYyhzcmMpKSB7XG4gICAgICAvLyBUb3AtbGV2ZWwgc2hvdWxkIG5ldmVyIHJlYWNoIGhlcmUuXG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgdGhpcy50b2tlbnMucHVzaCh7XG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgdGV4dDogY2FwWzBdXG4gICAgICB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChzcmMpIHtcbiAgICAgIHRocm93IG5ld1xuICAgICAgICBFcnJvcignSW5maW5pdGUgbG9vcCBvbiBieXRlOiAnICsgc3JjLmNoYXJDb2RlQXQoMCkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzLnRva2Vucztcbn07XG5cbi8qKlxuICogSW5saW5lLUxldmVsIEdyYW1tYXJcbiAqL1xuXG52YXIgaW5saW5lID0ge1xuICBlc2NhcGU6IC9eXFxcXChbXFxcXGAqe31cXFtcXF0oKSMrXFwtLiFfPl0pLyxcbiAgYXV0b2xpbms6IC9ePChbXiA+XSsoQHw6XFwvKVteID5dKyk+LyxcbiAgdXJsOiBub29wLFxuICB0YWc6IC9ePCEtLVtcXHNcXFNdKj8tLT58XjxcXC8/XFx3Kyg/OlwiW15cIl0qXCJ8J1teJ10qJ3xbXidcIj5dKSo/Pi8sXG4gIGxpbms6IC9eIT9cXFsoaW5zaWRlKVxcXVxcKGhyZWZcXCkvLFxuICByZWZsaW5rOiAvXiE/XFxbKGluc2lkZSlcXF1cXHMqXFxbKFteXFxdXSopXFxdLyxcbiAgbm9saW5rOiAvXiE/XFxbKCg/OlxcW1teXFxdXSpcXF18W15cXFtcXF1dKSopXFxdLyxcbiAgc3Ryb25nOiAvXl9fKFtcXHNcXFNdKz8pX18oPyFfKXxeXFwqXFwqKFtcXHNcXFNdKz8pXFwqXFwqKD8hXFwqKS8sXG4gIGVtOiAvXlxcYl8oKD86X198W1xcc1xcU10pKz8pX1xcYnxeXFwqKCg/OlxcKlxcKnxbXFxzXFxTXSkrPylcXCooPyFcXCopLyxcbiAgY29kZTogL14oYCspXFxzKihbXFxzXFxTXSo/W15gXSlcXHMqXFwxKD8hYCkvLFxuICBicjogL14gezIsfVxcbig/IVxccyokKS8sXG4gIGRlbDogbm9vcCxcbiAgdGV4dDogL15bXFxzXFxTXSs/KD89W1xcXFw8IVxcW18qYF18IHsyLH1cXG58JCkvXG59O1xuXG5pbmxpbmUuX2luc2lkZSA9IC8oPzpcXFtbXlxcXV0qXFxdfFteXFxbXFxdXXxcXF0oPz1bXlxcW10qXFxdKSkqLztcbmlubGluZS5faHJlZiA9IC9cXHMqPD8oW1xcc1xcU10qPyk+Pyg/OlxccytbJ1wiXShbXFxzXFxTXSo/KVsnXCJdKT9cXHMqLztcblxuaW5saW5lLmxpbmsgPSByZXBsYWNlKGlubGluZS5saW5rKVxuICAoJ2luc2lkZScsIGlubGluZS5faW5zaWRlKVxuICAoJ2hyZWYnLCBpbmxpbmUuX2hyZWYpXG4gICgpO1xuXG5pbmxpbmUucmVmbGluayA9IHJlcGxhY2UoaW5saW5lLnJlZmxpbmspXG4gICgnaW5zaWRlJywgaW5saW5lLl9pbnNpZGUpXG4gICgpO1xuXG4vKipcbiAqIE5vcm1hbCBJbmxpbmUgR3JhbW1hclxuICovXG5cbmlubGluZS5ub3JtYWwgPSBtZXJnZSh7fSwgaW5saW5lKTtcblxuLyoqXG4gKiBQZWRhbnRpYyBJbmxpbmUgR3JhbW1hclxuICovXG5cbmlubGluZS5wZWRhbnRpYyA9IG1lcmdlKHt9LCBpbmxpbmUubm9ybWFsLCB7XG4gIHN0cm9uZzogL15fXyg/PVxcUykoW1xcc1xcU10qP1xcUylfXyg/IV8pfF5cXCpcXCooPz1cXFMpKFtcXHNcXFNdKj9cXFMpXFwqXFwqKD8hXFwqKS8sXG4gIGVtOiAvXl8oPz1cXFMpKFtcXHNcXFNdKj9cXFMpXyg/IV8pfF5cXCooPz1cXFMpKFtcXHNcXFNdKj9cXFMpXFwqKD8hXFwqKS9cbn0pO1xuXG4vKipcbiAqIEdGTSBJbmxpbmUgR3JhbW1hclxuICovXG5cbmlubGluZS5nZm0gPSBtZXJnZSh7fSwgaW5saW5lLm5vcm1hbCwge1xuICBlc2NhcGU6IHJlcGxhY2UoaW5saW5lLmVzY2FwZSkoJ10pJywgJ358XSknKSgpLFxuICB1cmw6IC9eKGh0dHBzPzpcXC9cXC9bXlxcczxdK1tePC4sOjtcIicpXFxdXFxzXSkvLFxuICBkZWw6IC9efn4oPz1cXFMpKFtcXHNcXFNdKj9cXFMpfn4vLFxuICB0ZXh0OiByZXBsYWNlKGlubGluZS50ZXh0KVxuICAgICgnXXwnLCAnfl18JylcbiAgICAoJ3wnLCAnfGh0dHBzPzovL3wnKVxuICAgICgpXG59KTtcblxuLyoqXG4gKiBHRk0gKyBMaW5lIEJyZWFrcyBJbmxpbmUgR3JhbW1hclxuICovXG5cbmlubGluZS5icmVha3MgPSBtZXJnZSh7fSwgaW5saW5lLmdmbSwge1xuICBicjogcmVwbGFjZShpbmxpbmUuYnIpKCd7Mix9JywgJyonKSgpLFxuICB0ZXh0OiByZXBsYWNlKGlubGluZS5nZm0udGV4dCkoJ3syLH0nLCAnKicpKClcbn0pO1xuXG4vKipcbiAqIElubGluZSBMZXhlciAmIENvbXBpbGVyXG4gKi9cblxuZnVuY3Rpb24gSW5saW5lTGV4ZXIobGlua3MsIG9wdGlvbnMpIHtcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCBtYXJrZWQuZGVmYXVsdHM7XG4gIHRoaXMubGlua3MgPSBsaW5rcztcbiAgdGhpcy5ydWxlcyA9IGlubGluZS5ub3JtYWw7XG4gIHRoaXMucmVuZGVyZXIgPSB0aGlzLm9wdGlvbnMucmVuZGVyZXIgfHwgbmV3IFJlbmRlcmVyO1xuICB0aGlzLnJlbmRlcmVyLm9wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG5cbiAgaWYgKCF0aGlzLmxpbmtzKSB7XG4gICAgdGhyb3cgbmV3XG4gICAgICBFcnJvcignVG9rZW5zIGFycmF5IHJlcXVpcmVzIGEgYGxpbmtzYCBwcm9wZXJ0eS4nKTtcbiAgfVxuXG4gIGlmICh0aGlzLm9wdGlvbnMuZ2ZtKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy5icmVha3MpIHtcbiAgICAgIHRoaXMucnVsZXMgPSBpbmxpbmUuYnJlYWtzO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJ1bGVzID0gaW5saW5lLmdmbTtcbiAgICB9XG4gIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLnBlZGFudGljKSB7XG4gICAgdGhpcy5ydWxlcyA9IGlubGluZS5wZWRhbnRpYztcbiAgfVxufVxuXG4vKipcbiAqIEV4cG9zZSBJbmxpbmUgUnVsZXNcbiAqL1xuXG5JbmxpbmVMZXhlci5ydWxlcyA9IGlubGluZTtcblxuLyoqXG4gKiBTdGF0aWMgTGV4aW5nL0NvbXBpbGluZyBNZXRob2RcbiAqL1xuXG5JbmxpbmVMZXhlci5vdXRwdXQgPSBmdW5jdGlvbihzcmMsIGxpbmtzLCBvcHRpb25zKSB7XG4gIHZhciBpbmxpbmUgPSBuZXcgSW5saW5lTGV4ZXIobGlua3MsIG9wdGlvbnMpO1xuICByZXR1cm4gaW5saW5lLm91dHB1dChzcmMpO1xufTtcblxuLyoqXG4gKiBMZXhpbmcvQ29tcGlsaW5nXG4gKi9cblxuSW5saW5lTGV4ZXIucHJvdG90eXBlLm91dHB1dCA9IGZ1bmN0aW9uKHNyYykge1xuICB2YXIgb3V0ID0gJydcbiAgICAsIGxpbmtcbiAgICAsIHRleHRcbiAgICAsIGhyZWZcbiAgICAsIGNhcDtcblxuICB3aGlsZSAoc3JjKSB7XG4gICAgLy8gZXNjYXBlXG4gICAgaWYgKGNhcCA9IHRoaXMucnVsZXMuZXNjYXBlLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIG91dCArPSBjYXBbMV07XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBhdXRvbGlua1xuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLmF1dG9saW5rLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIGlmIChjYXBbMl0gPT09ICdAJykge1xuICAgICAgICB0ZXh0ID0gY2FwWzFdLmNoYXJBdCg2KSA9PT0gJzonXG4gICAgICAgICAgPyB0aGlzLm1hbmdsZShjYXBbMV0uc3Vic3RyaW5nKDcpKVxuICAgICAgICAgIDogdGhpcy5tYW5nbGUoY2FwWzFdKTtcbiAgICAgICAgaHJlZiA9IHRoaXMubWFuZ2xlKCdtYWlsdG86JykgKyB0ZXh0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGV4dCA9IGVzY2FwZShjYXBbMV0pO1xuICAgICAgICBocmVmID0gdGV4dDtcbiAgICAgIH1cbiAgICAgIG91dCArPSB0aGlzLnJlbmRlcmVyLmxpbmsoaHJlZiwgbnVsbCwgdGV4dCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyB1cmwgKGdmbSlcbiAgICBpZiAoIXRoaXMuaW5MaW5rICYmIChjYXAgPSB0aGlzLnJ1bGVzLnVybC5leGVjKHNyYykpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgdGV4dCA9IGVzY2FwZShjYXBbMV0pO1xuICAgICAgaHJlZiA9IHRleHQ7XG4gICAgICBvdXQgKz0gdGhpcy5yZW5kZXJlci5saW5rKGhyZWYsIG51bGwsIHRleHQpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gdGFnXG4gICAgaWYgKGNhcCA9IHRoaXMucnVsZXMudGFnLmV4ZWMoc3JjKSkge1xuICAgICAgaWYgKCF0aGlzLmluTGluayAmJiAvXjxhIC9pLnRlc3QoY2FwWzBdKSkge1xuICAgICAgICB0aGlzLmluTGluayA9IHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuaW5MaW5rICYmIC9ePFxcL2E+L2kudGVzdChjYXBbMF0pKSB7XG4gICAgICAgIHRoaXMuaW5MaW5rID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgb3V0ICs9IHRoaXMub3B0aW9ucy5zYW5pdGl6ZVxuICAgICAgICA/IGVzY2FwZShjYXBbMF0pXG4gICAgICAgIDogY2FwWzBdO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gbGlua1xuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLmxpbmsuZXhlYyhzcmMpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgdGhpcy5pbkxpbmsgPSB0cnVlO1xuICAgICAgb3V0ICs9IHRoaXMub3V0cHV0TGluayhjYXAsIHtcbiAgICAgICAgaHJlZjogY2FwWzJdLFxuICAgICAgICB0aXRsZTogY2FwWzNdXG4gICAgICB9KTtcbiAgICAgIHRoaXMuaW5MaW5rID0gZmFsc2U7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyByZWZsaW5rLCBub2xpbmtcbiAgICBpZiAoKGNhcCA9IHRoaXMucnVsZXMucmVmbGluay5leGVjKHNyYykpXG4gICAgICAgIHx8IChjYXAgPSB0aGlzLnJ1bGVzLm5vbGluay5leGVjKHNyYykpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgbGluayA9IChjYXBbMl0gfHwgY2FwWzFdKS5yZXBsYWNlKC9cXHMrL2csICcgJyk7XG4gICAgICBsaW5rID0gdGhpcy5saW5rc1tsaW5rLnRvTG93ZXJDYXNlKCldO1xuICAgICAgaWYgKCFsaW5rIHx8ICFsaW5rLmhyZWYpIHtcbiAgICAgICAgb3V0ICs9IGNhcFswXS5jaGFyQXQoMCk7XG4gICAgICAgIHNyYyA9IGNhcFswXS5zdWJzdHJpbmcoMSkgKyBzcmM7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgdGhpcy5pbkxpbmsgPSB0cnVlO1xuICAgICAgb3V0ICs9IHRoaXMub3V0cHV0TGluayhjYXAsIGxpbmspO1xuICAgICAgdGhpcy5pbkxpbmsgPSBmYWxzZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIHN0cm9uZ1xuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLnN0cm9uZy5leGVjKHNyYykpIHtcbiAgICAgIHNyYyA9IHNyYy5zdWJzdHJpbmcoY2FwWzBdLmxlbmd0aCk7XG4gICAgICBvdXQgKz0gdGhpcy5yZW5kZXJlci5zdHJvbmcodGhpcy5vdXRwdXQoY2FwWzJdIHx8IGNhcFsxXSkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gZW1cbiAgICBpZiAoY2FwID0gdGhpcy5ydWxlcy5lbS5leGVjKHNyYykpIHtcbiAgICAgIHNyYyA9IHNyYy5zdWJzdHJpbmcoY2FwWzBdLmxlbmd0aCk7XG4gICAgICBvdXQgKz0gdGhpcy5yZW5kZXJlci5lbSh0aGlzLm91dHB1dChjYXBbMl0gfHwgY2FwWzFdKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBjb2RlXG4gICAgaWYgKGNhcCA9IHRoaXMucnVsZXMuY29kZS5leGVjKHNyYykpIHtcbiAgICAgIHNyYyA9IHNyYy5zdWJzdHJpbmcoY2FwWzBdLmxlbmd0aCk7XG4gICAgICBvdXQgKz0gdGhpcy5yZW5kZXJlci5jb2Rlc3Bhbihlc2NhcGUoY2FwWzJdLCB0cnVlKSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBiclxuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLmJyLmV4ZWMoc3JjKSkge1xuICAgICAgc3JjID0gc3JjLnN1YnN0cmluZyhjYXBbMF0ubGVuZ3RoKTtcbiAgICAgIG91dCArPSB0aGlzLnJlbmRlcmVyLmJyKCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBkZWwgKGdmbSlcbiAgICBpZiAoY2FwID0gdGhpcy5ydWxlcy5kZWwuZXhlYyhzcmMpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgb3V0ICs9IHRoaXMucmVuZGVyZXIuZGVsKHRoaXMub3V0cHV0KGNhcFsxXSkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLy8gdGV4dFxuICAgIGlmIChjYXAgPSB0aGlzLnJ1bGVzLnRleHQuZXhlYyhzcmMpKSB7XG4gICAgICBzcmMgPSBzcmMuc3Vic3RyaW5nKGNhcFswXS5sZW5ndGgpO1xuICAgICAgb3V0ICs9IGVzY2FwZSh0aGlzLnNtYXJ0eXBhbnRzKGNhcFswXSkpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHNyYykge1xuICAgICAgdGhyb3cgbmV3XG4gICAgICAgIEVycm9yKCdJbmZpbml0ZSBsb29wIG9uIGJ5dGU6ICcgKyBzcmMuY2hhckNvZGVBdCgwKSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cbi8qKlxuICogQ29tcGlsZSBMaW5rXG4gKi9cblxuSW5saW5lTGV4ZXIucHJvdG90eXBlLm91dHB1dExpbmsgPSBmdW5jdGlvbihjYXAsIGxpbmspIHtcbiAgdmFyIGhyZWYgPSBlc2NhcGUobGluay5ocmVmKVxuICAgICwgdGl0bGUgPSBsaW5rLnRpdGxlID8gZXNjYXBlKGxpbmsudGl0bGUpIDogbnVsbDtcblxuICByZXR1cm4gY2FwWzBdLmNoYXJBdCgwKSAhPT0gJyEnXG4gICAgPyB0aGlzLnJlbmRlcmVyLmxpbmsoaHJlZiwgdGl0bGUsIHRoaXMub3V0cHV0KGNhcFsxXSkpXG4gICAgOiB0aGlzLnJlbmRlcmVyLmltYWdlKGhyZWYsIHRpdGxlLCBlc2NhcGUoY2FwWzFdKSk7XG59O1xuXG4vKipcbiAqIFNtYXJ0eXBhbnRzIFRyYW5zZm9ybWF0aW9uc1xuICovXG5cbklubGluZUxleGVyLnByb3RvdHlwZS5zbWFydHlwYW50cyA9IGZ1bmN0aW9uKHRleHQpIHtcbiAgaWYgKCF0aGlzLm9wdGlvbnMuc21hcnR5cGFudHMpIHJldHVybiB0ZXh0O1xuICByZXR1cm4gdGV4dFxuICAgIC8vIGVtLWRhc2hlc1xuICAgIC5yZXBsYWNlKC8tLS9nLCAnXFx1MjAxNCcpXG4gICAgLy8gb3BlbmluZyBzaW5nbGVzXG4gICAgLnJlcGxhY2UoLyhefFstXFx1MjAxNC8oXFxbe1wiXFxzXSknL2csICckMVxcdTIwMTgnKVxuICAgIC8vIGNsb3Npbmcgc2luZ2xlcyAmIGFwb3N0cm9waGVzXG4gICAgLnJlcGxhY2UoLycvZywgJ1xcdTIwMTknKVxuICAgIC8vIG9wZW5pbmcgZG91Ymxlc1xuICAgIC5yZXBsYWNlKC8oXnxbLVxcdTIwMTQvKFxcW3tcXHUyMDE4XFxzXSlcIi9nLCAnJDFcXHUyMDFjJylcbiAgICAvLyBjbG9zaW5nIGRvdWJsZXNcbiAgICAucmVwbGFjZSgvXCIvZywgJ1xcdTIwMWQnKVxuICAgIC8vIGVsbGlwc2VzXG4gICAgLnJlcGxhY2UoL1xcLnszfS9nLCAnXFx1MjAyNicpO1xufTtcblxuLyoqXG4gKiBNYW5nbGUgTGlua3NcbiAqL1xuXG5JbmxpbmVMZXhlci5wcm90b3R5cGUubWFuZ2xlID0gZnVuY3Rpb24odGV4dCkge1xuICB2YXIgb3V0ID0gJydcbiAgICAsIGwgPSB0ZXh0Lmxlbmd0aFxuICAgICwgaSA9IDBcbiAgICAsIGNoO1xuXG4gIGZvciAoOyBpIDwgbDsgaSsrKSB7XG4gICAgY2ggPSB0ZXh0LmNoYXJDb2RlQXQoaSk7XG4gICAgaWYgKE1hdGgucmFuZG9tKCkgPiAwLjUpIHtcbiAgICAgIGNoID0gJ3gnICsgY2gudG9TdHJpbmcoMTYpO1xuICAgIH1cbiAgICBvdXQgKz0gJyYjJyArIGNoICsgJzsnO1xuICB9XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cbi8qKlxuICogUmVuZGVyZXJcbiAqL1xuXG5mdW5jdGlvbiBSZW5kZXJlcihvcHRpb25zKSB7XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG59XG5cblJlbmRlcmVyLnByb3RvdHlwZS5jb2RlID0gZnVuY3Rpb24oY29kZSwgbGFuZywgZXNjYXBlZCkge1xuICBpZiAodGhpcy5vcHRpb25zLmhpZ2hsaWdodCkge1xuICAgIHZhciBvdXQgPSB0aGlzLm9wdGlvbnMuaGlnaGxpZ2h0KGNvZGUsIGxhbmcpO1xuICAgIGlmIChvdXQgIT0gbnVsbCAmJiBvdXQgIT09IGNvZGUpIHtcbiAgICAgIGVzY2FwZWQgPSB0cnVlO1xuICAgICAgY29kZSA9IG91dDtcbiAgICB9XG4gIH1cblxuICBpZiAoIWxhbmcpIHtcbiAgICByZXR1cm4gJzxwcmU+PGNvZGU+J1xuICAgICAgKyAoZXNjYXBlZCA/IGNvZGUgOiBlc2NhcGUoY29kZSwgdHJ1ZSkpXG4gICAgICArICdcXG48L2NvZGU+PC9wcmU+JztcbiAgfVxuXG4gIHJldHVybiAnPHByZT48Y29kZSBjbGFzcz1cIidcbiAgICArIHRoaXMub3B0aW9ucy5sYW5nUHJlZml4XG4gICAgKyBlc2NhcGUobGFuZywgdHJ1ZSlcbiAgICArICdcIj4nXG4gICAgKyAoZXNjYXBlZCA/IGNvZGUgOiBlc2NhcGUoY29kZSwgdHJ1ZSkpXG4gICAgKyAnXFxuPC9jb2RlPjwvcHJlPlxcbic7XG59O1xuXG5SZW5kZXJlci5wcm90b3R5cGUuYmxvY2txdW90ZSA9IGZ1bmN0aW9uKHF1b3RlKSB7XG4gIHJldHVybiAnPGJsb2NrcXVvdGU+XFxuJyArIHF1b3RlICsgJzwvYmxvY2txdW90ZT5cXG4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLmh0bWwgPSBmdW5jdGlvbihodG1sKSB7XG4gIHJldHVybiBodG1sO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLmhlYWRpbmcgPSBmdW5jdGlvbih0ZXh0LCBsZXZlbCwgcmF3KSB7XG4gIHJldHVybiAnPGgnXG4gICAgKyBsZXZlbFxuICAgICsgJyBpZD1cIidcbiAgICArIHRoaXMub3B0aW9ucy5oZWFkZXJQcmVmaXhcbiAgICArIHJhdy50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teXFx3XSsvZywgJy0nKVxuICAgICsgJ1wiPidcbiAgICArIHRleHRcbiAgICArICc8L2gnXG4gICAgKyBsZXZlbFxuICAgICsgJz5cXG4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLmhyID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLm9wdGlvbnMueGh0bWwgPyAnPGhyLz5cXG4nIDogJzxocj5cXG4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLmxpc3QgPSBmdW5jdGlvbihib2R5LCBvcmRlcmVkKSB7XG4gIHZhciB0eXBlID0gb3JkZXJlZCA/ICdvbCcgOiAndWwnO1xuICByZXR1cm4gJzwnICsgdHlwZSArICc+XFxuJyArIGJvZHkgKyAnPC8nICsgdHlwZSArICc+XFxuJztcbn07XG5cblJlbmRlcmVyLnByb3RvdHlwZS5saXN0aXRlbSA9IGZ1bmN0aW9uKHRleHQpIHtcbiAgcmV0dXJuICc8bGk+JyArIHRleHQgKyAnPC9saT5cXG4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLnBhcmFncmFwaCA9IGZ1bmN0aW9uKHRleHQpIHtcbiAgcmV0dXJuICc8cD4nICsgdGV4dCArICc8L3A+XFxuJztcbn07XG5cblJlbmRlcmVyLnByb3RvdHlwZS50YWJsZSA9IGZ1bmN0aW9uKGhlYWRlciwgYm9keSkge1xuICByZXR1cm4gJzx0YWJsZT5cXG4nXG4gICAgKyAnPHRoZWFkPlxcbidcbiAgICArIGhlYWRlclxuICAgICsgJzwvdGhlYWQ+XFxuJ1xuICAgICsgJzx0Ym9keT5cXG4nXG4gICAgKyBib2R5XG4gICAgKyAnPC90Ym9keT5cXG4nXG4gICAgKyAnPC90YWJsZT5cXG4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLnRhYmxlcm93ID0gZnVuY3Rpb24oY29udGVudCkge1xuICByZXR1cm4gJzx0cj5cXG4nICsgY29udGVudCArICc8L3RyPlxcbic7XG59O1xuXG5SZW5kZXJlci5wcm90b3R5cGUudGFibGVjZWxsID0gZnVuY3Rpb24oY29udGVudCwgZmxhZ3MpIHtcbiAgdmFyIHR5cGUgPSBmbGFncy5oZWFkZXIgPyAndGgnIDogJ3RkJztcbiAgdmFyIHRhZyA9IGZsYWdzLmFsaWduXG4gICAgPyAnPCcgKyB0eXBlICsgJyBzdHlsZT1cInRleHQtYWxpZ246JyArIGZsYWdzLmFsaWduICsgJ1wiPidcbiAgICA6ICc8JyArIHR5cGUgKyAnPic7XG4gIHJldHVybiB0YWcgKyBjb250ZW50ICsgJzwvJyArIHR5cGUgKyAnPlxcbic7XG59O1xuXG4vLyBzcGFuIGxldmVsIHJlbmRlcmVyXG5SZW5kZXJlci5wcm90b3R5cGUuc3Ryb25nID0gZnVuY3Rpb24odGV4dCkge1xuICByZXR1cm4gJzxzdHJvbmc+JyArIHRleHQgKyAnPC9zdHJvbmc+Jztcbn07XG5cblJlbmRlcmVyLnByb3RvdHlwZS5lbSA9IGZ1bmN0aW9uKHRleHQpIHtcbiAgcmV0dXJuICc8ZW0+JyArIHRleHQgKyAnPC9lbT4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLmNvZGVzcGFuID0gZnVuY3Rpb24odGV4dCkge1xuICByZXR1cm4gJzxjb2RlPicgKyB0ZXh0ICsgJzwvY29kZT4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLmJyID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLm9wdGlvbnMueGh0bWwgPyAnPGJyLz4nIDogJzxicj4nO1xufTtcblxuUmVuZGVyZXIucHJvdG90eXBlLmRlbCA9IGZ1bmN0aW9uKHRleHQpIHtcbiAgcmV0dXJuICc8ZGVsPicgKyB0ZXh0ICsgJzwvZGVsPic7XG59O1xuXG5SZW5kZXJlci5wcm90b3R5cGUubGluayA9IGZ1bmN0aW9uKGhyZWYsIHRpdGxlLCB0ZXh0KSB7XG4gIGlmICh0aGlzLm9wdGlvbnMuc2FuaXRpemUpIHtcbiAgICB0cnkge1xuICAgICAgdmFyIHByb3QgPSBkZWNvZGVVUklDb21wb25lbnQodW5lc2NhcGUoaHJlZikpXG4gICAgICAgIC5yZXBsYWNlKC9bXlxcdzpdL2csICcnKVxuICAgICAgICAudG9Mb3dlckNhc2UoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIGlmIChwcm90LmluZGV4T2YoJ2phdmFzY3JpcHQ6JykgPT09IDAgfHwgcHJvdC5pbmRleE9mKCd2YnNjcmlwdDonKSA9PT0gMCkge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuICB2YXIgb3V0ID0gJzxhIGhyZWY9XCInICsgaHJlZiArICdcIic7XG4gIGlmICh0aXRsZSkge1xuICAgIG91dCArPSAnIHRpdGxlPVwiJyArIHRpdGxlICsgJ1wiJztcbiAgfVxuICBvdXQgKz0gJz4nICsgdGV4dCArICc8L2E+JztcbiAgcmV0dXJuIG91dDtcbn07XG5cblJlbmRlcmVyLnByb3RvdHlwZS5pbWFnZSA9IGZ1bmN0aW9uKGhyZWYsIHRpdGxlLCB0ZXh0KSB7XG4gIHZhciBvdXQgPSAnPGltZyBzcmM9XCInICsgaHJlZiArICdcIiBhbHQ9XCInICsgdGV4dCArICdcIic7XG4gIGlmICh0aXRsZSkge1xuICAgIG91dCArPSAnIHRpdGxlPVwiJyArIHRpdGxlICsgJ1wiJztcbiAgfVxuICBvdXQgKz0gdGhpcy5vcHRpb25zLnhodG1sID8gJy8+JyA6ICc+JztcbiAgcmV0dXJuIG91dDtcbn07XG5cbi8qKlxuICogUGFyc2luZyAmIENvbXBpbGluZ1xuICovXG5cbmZ1bmN0aW9uIFBhcnNlcihvcHRpb25zKSB7XG4gIHRoaXMudG9rZW5zID0gW107XG4gIHRoaXMudG9rZW4gPSBudWxsO1xuICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IG1hcmtlZC5kZWZhdWx0cztcbiAgdGhpcy5vcHRpb25zLnJlbmRlcmVyID0gdGhpcy5vcHRpb25zLnJlbmRlcmVyIHx8IG5ldyBSZW5kZXJlcjtcbiAgdGhpcy5yZW5kZXJlciA9IHRoaXMub3B0aW9ucy5yZW5kZXJlcjtcbiAgdGhpcy5yZW5kZXJlci5vcHRpb25zID0gdGhpcy5vcHRpb25zO1xufVxuXG4vKipcbiAqIFN0YXRpYyBQYXJzZSBNZXRob2RcbiAqL1xuXG5QYXJzZXIucGFyc2UgPSBmdW5jdGlvbihzcmMsIG9wdGlvbnMsIHJlbmRlcmVyKSB7XG4gIHZhciBwYXJzZXIgPSBuZXcgUGFyc2VyKG9wdGlvbnMsIHJlbmRlcmVyKTtcbiAgcmV0dXJuIHBhcnNlci5wYXJzZShzcmMpO1xufTtcblxuLyoqXG4gKiBQYXJzZSBMb29wXG4gKi9cblxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uKHNyYykge1xuICB0aGlzLmlubGluZSA9IG5ldyBJbmxpbmVMZXhlcihzcmMubGlua3MsIHRoaXMub3B0aW9ucywgdGhpcy5yZW5kZXJlcik7XG4gIHRoaXMudG9rZW5zID0gc3JjLnJldmVyc2UoKTtcblxuICB2YXIgb3V0ID0gJyc7XG4gIHdoaWxlICh0aGlzLm5leHQoKSkge1xuICAgIG91dCArPSB0aGlzLnRvaygpO1xuICB9XG5cbiAgcmV0dXJuIG91dDtcbn07XG5cbi8qKlxuICogTmV4dCBUb2tlblxuICovXG5cblBhcnNlci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy50b2tlbiA9IHRoaXMudG9rZW5zLnBvcCgpO1xufTtcblxuLyoqXG4gKiBQcmV2aWV3IE5leHQgVG9rZW5cbiAqL1xuXG5QYXJzZXIucHJvdG90eXBlLnBlZWsgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMudG9rZW5zW3RoaXMudG9rZW5zLmxlbmd0aCAtIDFdIHx8IDA7XG59O1xuXG4vKipcbiAqIFBhcnNlIFRleHQgVG9rZW5zXG4gKi9cblxuUGFyc2VyLnByb3RvdHlwZS5wYXJzZVRleHQgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGJvZHkgPSB0aGlzLnRva2VuLnRleHQ7XG5cbiAgd2hpbGUgKHRoaXMucGVlaygpLnR5cGUgPT09ICd0ZXh0Jykge1xuICAgIGJvZHkgKz0gJ1xcbicgKyB0aGlzLm5leHQoKS50ZXh0O1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuaW5saW5lLm91dHB1dChib2R5KTtcbn07XG5cbi8qKlxuICogUGFyc2UgQ3VycmVudCBUb2tlblxuICovXG5cblBhcnNlci5wcm90b3R5cGUudG9rID0gZnVuY3Rpb24oKSB7XG4gIHN3aXRjaCAodGhpcy50b2tlbi50eXBlKSB7XG4gICAgY2FzZSAnc3BhY2UnOiB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIGNhc2UgJ2hyJzoge1xuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyZXIuaHIoKTtcbiAgICB9XG4gICAgY2FzZSAnaGVhZGluZyc6IHtcbiAgICAgIHJldHVybiB0aGlzLnJlbmRlcmVyLmhlYWRpbmcoXG4gICAgICAgIHRoaXMuaW5saW5lLm91dHB1dCh0aGlzLnRva2VuLnRleHQpLFxuICAgICAgICB0aGlzLnRva2VuLmRlcHRoLFxuICAgICAgICB0aGlzLnRva2VuLnRleHQpO1xuICAgIH1cbiAgICBjYXNlICdjb2RlJzoge1xuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyZXIuY29kZSh0aGlzLnRva2VuLnRleHQsXG4gICAgICAgIHRoaXMudG9rZW4ubGFuZyxcbiAgICAgICAgdGhpcy50b2tlbi5lc2NhcGVkKTtcbiAgICB9XG4gICAgY2FzZSAndGFibGUnOiB7XG4gICAgICB2YXIgaGVhZGVyID0gJydcbiAgICAgICAgLCBib2R5ID0gJydcbiAgICAgICAgLCBpXG4gICAgICAgICwgcm93XG4gICAgICAgICwgY2VsbFxuICAgICAgICAsIGZsYWdzXG4gICAgICAgICwgajtcblxuICAgICAgLy8gaGVhZGVyXG4gICAgICBjZWxsID0gJyc7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy50b2tlbi5oZWFkZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZmxhZ3MgPSB7IGhlYWRlcjogdHJ1ZSwgYWxpZ246IHRoaXMudG9rZW4uYWxpZ25baV0gfTtcbiAgICAgICAgY2VsbCArPSB0aGlzLnJlbmRlcmVyLnRhYmxlY2VsbChcbiAgICAgICAgICB0aGlzLmlubGluZS5vdXRwdXQodGhpcy50b2tlbi5oZWFkZXJbaV0pLFxuICAgICAgICAgIHsgaGVhZGVyOiB0cnVlLCBhbGlnbjogdGhpcy50b2tlbi5hbGlnbltpXSB9XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBoZWFkZXIgKz0gdGhpcy5yZW5kZXJlci50YWJsZXJvdyhjZWxsKTtcblxuICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMudG9rZW4uY2VsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcm93ID0gdGhpcy50b2tlbi5jZWxsc1tpXTtcblxuICAgICAgICBjZWxsID0gJyc7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCByb3cubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBjZWxsICs9IHRoaXMucmVuZGVyZXIudGFibGVjZWxsKFxuICAgICAgICAgICAgdGhpcy5pbmxpbmUub3V0cHV0KHJvd1tqXSksXG4gICAgICAgICAgICB7IGhlYWRlcjogZmFsc2UsIGFsaWduOiB0aGlzLnRva2VuLmFsaWduW2pdIH1cbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgYm9keSArPSB0aGlzLnJlbmRlcmVyLnRhYmxlcm93KGNlbGwpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyZXIudGFibGUoaGVhZGVyLCBib2R5KTtcbiAgICB9XG4gICAgY2FzZSAnYmxvY2txdW90ZV9zdGFydCc6IHtcbiAgICAgIHZhciBib2R5ID0gJyc7XG5cbiAgICAgIHdoaWxlICh0aGlzLm5leHQoKS50eXBlICE9PSAnYmxvY2txdW90ZV9lbmQnKSB7XG4gICAgICAgIGJvZHkgKz0gdGhpcy50b2soKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyZXIuYmxvY2txdW90ZShib2R5KTtcbiAgICB9XG4gICAgY2FzZSAnbGlzdF9zdGFydCc6IHtcbiAgICAgIHZhciBib2R5ID0gJydcbiAgICAgICAgLCBvcmRlcmVkID0gdGhpcy50b2tlbi5vcmRlcmVkO1xuXG4gICAgICB3aGlsZSAodGhpcy5uZXh0KCkudHlwZSAhPT0gJ2xpc3RfZW5kJykge1xuICAgICAgICBib2R5ICs9IHRoaXMudG9rKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLnJlbmRlcmVyLmxpc3QoYm9keSwgb3JkZXJlZCk7XG4gICAgfVxuICAgIGNhc2UgJ2xpc3RfaXRlbV9zdGFydCc6IHtcbiAgICAgIHZhciBib2R5ID0gJyc7XG5cbiAgICAgIHdoaWxlICh0aGlzLm5leHQoKS50eXBlICE9PSAnbGlzdF9pdGVtX2VuZCcpIHtcbiAgICAgICAgYm9keSArPSB0aGlzLnRva2VuLnR5cGUgPT09ICd0ZXh0J1xuICAgICAgICAgID8gdGhpcy5wYXJzZVRleHQoKVxuICAgICAgICAgIDogdGhpcy50b2soKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyZXIubGlzdGl0ZW0oYm9keSk7XG4gICAgfVxuICAgIGNhc2UgJ2xvb3NlX2l0ZW1fc3RhcnQnOiB7XG4gICAgICB2YXIgYm9keSA9ICcnO1xuXG4gICAgICB3aGlsZSAodGhpcy5uZXh0KCkudHlwZSAhPT0gJ2xpc3RfaXRlbV9lbmQnKSB7XG4gICAgICAgIGJvZHkgKz0gdGhpcy50b2soKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyZXIubGlzdGl0ZW0oYm9keSk7XG4gICAgfVxuICAgIGNhc2UgJ2h0bWwnOiB7XG4gICAgICB2YXIgaHRtbCA9ICF0aGlzLnRva2VuLnByZSAmJiAhdGhpcy5vcHRpb25zLnBlZGFudGljXG4gICAgICAgID8gdGhpcy5pbmxpbmUub3V0cHV0KHRoaXMudG9rZW4udGV4dClcbiAgICAgICAgOiB0aGlzLnRva2VuLnRleHQ7XG4gICAgICByZXR1cm4gdGhpcy5yZW5kZXJlci5odG1sKGh0bWwpO1xuICAgIH1cbiAgICBjYXNlICdwYXJhZ3JhcGgnOiB7XG4gICAgICByZXR1cm4gdGhpcy5yZW5kZXJlci5wYXJhZ3JhcGgodGhpcy5pbmxpbmUub3V0cHV0KHRoaXMudG9rZW4udGV4dCkpO1xuICAgIH1cbiAgICBjYXNlICd0ZXh0Jzoge1xuICAgICAgcmV0dXJuIHRoaXMucmVuZGVyZXIucGFyYWdyYXBoKHRoaXMucGFyc2VUZXh0KCkpO1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBIZWxwZXJzXG4gKi9cblxuZnVuY3Rpb24gZXNjYXBlKGh0bWwsIGVuY29kZSkge1xuICByZXR1cm4gaHRtbFxuICAgIC5yZXBsYWNlKCFlbmNvZGUgPyAvJig/ISM/XFx3KzspL2cgOiAvJi9nLCAnJmFtcDsnKVxuICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcbiAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpXG4gICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxuICAgIC5yZXBsYWNlKC8nL2csICcmIzM5OycpO1xufVxuXG5mdW5jdGlvbiB1bmVzY2FwZShodG1sKSB7XG4gIHJldHVybiBodG1sLnJlcGxhY2UoLyYoWyNcXHddKyk7L2csIGZ1bmN0aW9uKF8sIG4pIHtcbiAgICBuID0gbi50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChuID09PSAnY29sb24nKSByZXR1cm4gJzonO1xuICAgIGlmIChuLmNoYXJBdCgwKSA9PT0gJyMnKSB7XG4gICAgICByZXR1cm4gbi5jaGFyQXQoMSkgPT09ICd4J1xuICAgICAgICA/IFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQobi5zdWJzdHJpbmcoMiksIDE2KSlcbiAgICAgICAgOiBTdHJpbmcuZnJvbUNoYXJDb2RlKCtuLnN1YnN0cmluZygxKSk7XG4gICAgfVxuICAgIHJldHVybiAnJztcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2UocmVnZXgsIG9wdCkge1xuICByZWdleCA9IHJlZ2V4LnNvdXJjZTtcbiAgb3B0ID0gb3B0IHx8ICcnO1xuICByZXR1cm4gZnVuY3Rpb24gc2VsZihuYW1lLCB2YWwpIHtcbiAgICBpZiAoIW5hbWUpIHJldHVybiBuZXcgUmVnRXhwKHJlZ2V4LCBvcHQpO1xuICAgIHZhbCA9IHZhbC5zb3VyY2UgfHwgdmFsO1xuICAgIHZhbCA9IHZhbC5yZXBsYWNlKC8oXnxbXlxcW10pXFxeL2csICckMScpO1xuICAgIHJlZ2V4ID0gcmVnZXgucmVwbGFjZShuYW1lLCB2YWwpO1xuICAgIHJldHVybiBzZWxmO1xuICB9O1xufVxuXG5mdW5jdGlvbiBub29wKCkge31cbm5vb3AuZXhlYyA9IG5vb3A7XG5cbmZ1bmN0aW9uIG1lcmdlKG9iaikge1xuICB2YXIgaSA9IDFcbiAgICAsIHRhcmdldFxuICAgICwga2V5O1xuXG4gIGZvciAoOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdGFyZ2V0ID0gYXJndW1lbnRzW2ldO1xuICAgIGZvciAoa2V5IGluIHRhcmdldCkge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0YXJnZXQsIGtleSkpIHtcbiAgICAgICAgb2JqW2tleV0gPSB0YXJnZXRba2V5XTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gb2JqO1xufVxuXG5cbi8qKlxuICogTWFya2VkXG4gKi9cblxuZnVuY3Rpb24gbWFya2VkKHNyYywgb3B0LCBjYWxsYmFjaykge1xuICBpZiAoY2FsbGJhY2sgfHwgdHlwZW9mIG9wdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0O1xuICAgICAgb3B0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBvcHQgPSBtZXJnZSh7fSwgbWFya2VkLmRlZmF1bHRzLCBvcHQgfHwge30pO1xuXG4gICAgdmFyIGhpZ2hsaWdodCA9IG9wdC5oaWdobGlnaHRcbiAgICAgICwgdG9rZW5zXG4gICAgICAsIHBlbmRpbmdcbiAgICAgICwgaSA9IDA7XG5cbiAgICB0cnkge1xuICAgICAgdG9rZW5zID0gTGV4ZXIubGV4KHNyYywgb3B0KVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBjYWxsYmFjayhlKTtcbiAgICB9XG5cbiAgICBwZW5kaW5nID0gdG9rZW5zLmxlbmd0aDtcblxuICAgIHZhciBkb25lID0gZnVuY3Rpb24oZXJyKSB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIG9wdC5oaWdobGlnaHQgPSBoaWdobGlnaHQ7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhlcnIpO1xuICAgICAgfVxuXG4gICAgICB2YXIgb3V0O1xuXG4gICAgICB0cnkge1xuICAgICAgICBvdXQgPSBQYXJzZXIucGFyc2UodG9rZW5zLCBvcHQpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBlcnIgPSBlO1xuICAgICAgfVxuXG4gICAgICBvcHQuaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0O1xuXG4gICAgICByZXR1cm4gZXJyXG4gICAgICAgID8gY2FsbGJhY2soZXJyKVxuICAgICAgICA6IGNhbGxiYWNrKG51bGwsIG91dCk7XG4gICAgfTtcblxuICAgIGlmICghaGlnaGxpZ2h0IHx8IGhpZ2hsaWdodC5sZW5ndGggPCAzKSB7XG4gICAgICByZXR1cm4gZG9uZSgpO1xuICAgIH1cblxuICAgIGRlbGV0ZSBvcHQuaGlnaGxpZ2h0O1xuXG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm4gZG9uZSgpO1xuXG4gICAgZm9yICg7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgIChmdW5jdGlvbih0b2tlbikge1xuICAgICAgICBpZiAodG9rZW4udHlwZSAhPT0gJ2NvZGUnKSB7XG4gICAgICAgICAgcmV0dXJuIC0tcGVuZGluZyB8fCBkb25lKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhpZ2hsaWdodCh0b2tlbi50ZXh0LCB0b2tlbi5sYW5nLCBmdW5jdGlvbihlcnIsIGNvZGUpIHtcbiAgICAgICAgICBpZiAoZXJyKSByZXR1cm4gZG9uZShlcnIpO1xuICAgICAgICAgIGlmIChjb2RlID09IG51bGwgfHwgY29kZSA9PT0gdG9rZW4udGV4dCkge1xuICAgICAgICAgICAgcmV0dXJuIC0tcGVuZGluZyB8fCBkb25lKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRva2VuLnRleHQgPSBjb2RlO1xuICAgICAgICAgIHRva2VuLmVzY2FwZWQgPSB0cnVlO1xuICAgICAgICAgIC0tcGVuZGluZyB8fCBkb25lKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSkodG9rZW5zW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm47XG4gIH1cbiAgdHJ5IHtcbiAgICBpZiAob3B0KSBvcHQgPSBtZXJnZSh7fSwgbWFya2VkLmRlZmF1bHRzLCBvcHQpO1xuICAgIHJldHVybiBQYXJzZXIucGFyc2UoTGV4ZXIubGV4KHNyYywgb3B0KSwgb3B0KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGUubWVzc2FnZSArPSAnXFxuUGxlYXNlIHJlcG9ydCB0aGlzIHRvIGh0dHBzOi8vZ2l0aHViLmNvbS9jaGpqL21hcmtlZC4nO1xuICAgIGlmICgob3B0IHx8IG1hcmtlZC5kZWZhdWx0cykuc2lsZW50KSB7XG4gICAgICByZXR1cm4gJzxwPkFuIGVycm9yIG9jY3VyZWQ6PC9wPjxwcmU+J1xuICAgICAgICArIGVzY2FwZShlLm1lc3NhZ2UgKyAnJywgdHJ1ZSlcbiAgICAgICAgKyAnPC9wcmU+JztcbiAgICB9XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbnNcbiAqL1xuXG5tYXJrZWQub3B0aW9ucyA9XG5tYXJrZWQuc2V0T3B0aW9ucyA9IGZ1bmN0aW9uKG9wdCkge1xuICBtZXJnZShtYXJrZWQuZGVmYXVsdHMsIG9wdCk7XG4gIHJldHVybiBtYXJrZWQ7XG59O1xuXG5tYXJrZWQuZGVmYXVsdHMgPSB7XG4gIGdmbTogdHJ1ZSxcbiAgdGFibGVzOiB0cnVlLFxuICBicmVha3M6IGZhbHNlLFxuICBwZWRhbnRpYzogZmFsc2UsXG4gIHNhbml0aXplOiBmYWxzZSxcbiAgc21hcnRMaXN0czogZmFsc2UsXG4gIHNpbGVudDogZmFsc2UsXG4gIGhpZ2hsaWdodDogbnVsbCxcbiAgbGFuZ1ByZWZpeDogJ2xhbmctJyxcbiAgc21hcnR5cGFudHM6IGZhbHNlLFxuICBoZWFkZXJQcmVmaXg6ICcnLFxuICByZW5kZXJlcjogbmV3IFJlbmRlcmVyLFxuICB4aHRtbDogZmFsc2Vcbn07XG5cbi8qKlxuICogRXhwb3NlXG4gKi9cblxubWFya2VkLlBhcnNlciA9IFBhcnNlcjtcbm1hcmtlZC5wYXJzZXIgPSBQYXJzZXIucGFyc2U7XG5cbm1hcmtlZC5SZW5kZXJlciA9IFJlbmRlcmVyO1xuXG5tYXJrZWQuTGV4ZXIgPSBMZXhlcjtcbm1hcmtlZC5sZXhlciA9IExleGVyLmxleDtcblxubWFya2VkLklubGluZUxleGVyID0gSW5saW5lTGV4ZXI7XG5tYXJrZWQuaW5saW5lTGV4ZXIgPSBJbmxpbmVMZXhlci5vdXRwdXQ7XG5cbm1hcmtlZC5wYXJzZSA9IG1hcmtlZDtcblxuaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICBtb2R1bGUuZXhwb3J0cyA9IG1hcmtlZDtcbn0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gIGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIG1hcmtlZDsgfSk7XG59IGVsc2Uge1xuICB0aGlzLm1hcmtlZCA9IG1hcmtlZDtcbn1cblxufSkuY2FsbChmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMgfHwgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogZ2xvYmFsKTtcbn0oKSk7XG4iLCIvLyB2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdCcpO1xuLy8gdmFyIGQzID0gcmVxdWlyZSgnZDMnKTtcbnZhciBkM0JhciA9IHJlcXVpcmUoJy4vZDNCYXIuanMnKTtcblxudmFyIEJhckNvbnRhaW5lciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IDgwMCxcbiAgICAgIGhlaWdodDogNTAwLFxuICAgIH07XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNCYXIuY3JlYXRlKGVsLCB7XG4gICAgICB3aWR0aDogdGhpcy5wcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogdGhpcy5wcm9wcy5oZWlnaHQsXG4gICAgICBjc3Y6IHRoaXMucHJvcHMuY3N2XG4gICAgfSwgdGhpcy5zdGF0ZSk7XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkVXBkYXRlOiBmdW5jdGlvbihwcmV2UHJvcHMsIHByZXZTdGF0ZSkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNCYXIudXBkYXRlKGVsLCB0aGlzLnByb3BzKTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvd1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLThcIj5cbiAgICAgICAgICAgIDxoMz57dGhpcy5wcm9wcy50aXRsZX08L2gzPlxuICAgICAgICAgICAgPGhyIC8+XG4gICAgICAgICAgICA8ZGl2IHJlZj1cImQzXCI+PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfSxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhckNvbnRhaW5lcjtcbiIsIi8vIHZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0Jyk7XG4vLyB2YXIgZDMgPSByZXF1aXJlKCdkMycpO1xudmFyIGQzQ2FudmFzRmVhdCA9IHJlcXVpcmUoJy4vZDNDYW52YXNGZWF0LmpzJyk7XG5cbnZhciBDYW52YXNGZWF0Q29udGFpbmVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIGxvYWRKU09ORnJvbVNlcnZlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdXJsOiB0aGlzLnByb3BzLnVybCxcbiAgICAgICAgICAgIGRhdGFUeXBlOiAnanNvbicsXG4gICAgICAgICAgICBjYWNoZTogZmFsc2UsXG4gICAgICAgICAgICBzdWNjZXNzOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7ZGF0YTogZGF0YX0pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKHhociwgc3RhdHVzLCBlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKHRoaXMucHJvcHMudXJsLCBzdGF0dXMsIGVyci50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKVxuICAgICAgICB9KTtcbiAgICB9LFxuXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7ZGF0YTogW10sXG4gICAgICAgICAgICAgICAgbG9jYXRpb246IHt4OiAxMjAsIHk6IDEwMCwgdzogODAsIGg6IDgwfSxcbiAgICAgICAgfTtcbiAgICB9LFxuICBnZXREZWZhdWx0UHJvcHM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICBtb3ZlOiB0cnVlLFxuICAgICAgdGl0bGU6IFwiXCIsXG4gICAgICB3aWR0aDogOTYwLFxuICAgICAgaGVpZ2h0OiA2MDAsXG4gICAgICBzY2FsZTogMS4wLFxuICAgICAgcGl4ZWxhdGVkOiB0cnVlLFxuICAgICAgeWJsb2NrOiAxLFxuICAgICAgeGJsb2NrOiAxLFxuICAgICAgZ3JpZDogZmFsc2UsXG4gICAgICBzZWFyY2g6IHt4OiAzMjAsIHk6IDE2MCwgdzogMjQwLCBoOiAyNDB9LFxuICAgICAgZmVhdHVyZToge3g6IDYwMCwgeTogMCwgdzogNTAwLCBoOiA1MDB9LFxuICAgIH07XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMubG9hZEpTT05Gcm9tU2VydmVyKCk7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0NhbnZhc0ZlYXQuY3JlYXRlKGVsLCB0aGlzLnByb3BzLCB0aGlzLnN0YXRlKTtcblxuICAgIGlmKHRoaXMucHJvcHMubW92ZSA9PSB0cnVlKSB7XG4gICAgICAvLyB0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwodGhpcy5fc3RlcCwgMTAwKTtcbiAgICB9XG4gIH0sXG5cbiAgX3N0ZXA6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBuZXh0X2xvY2F0aW9uID0gdGhpcy5zdGF0ZS5sb2NhdGlvbjtcblxuICAgIG5leHRfbG9jYXRpb24ueCArPSAxO1xuICAgIGlmKG5leHRfbG9jYXRpb24ueCArIG5leHRfbG9jYXRpb24udyA+IDI5OSl7XG4gICAgICBuZXh0X2xvY2F0aW9uLnggPSAwO1xuICAgICAgbmV4dF9sb2NhdGlvbi55ICs9IDE7XG4gICAgfVxuICAgIGlmKG5leHRfbG9jYXRpb24ueSArIG5leHRfbG9jYXRpb24uaCA+IDIxOSl7XG4gICAgICBuZXh0X2xvY2F0aW9uLnkgPSAwO1xuICAgIH1cbiAgXG4gICAgdGhpcy5zZXRTdGF0ZSh7bG9jYXRpb246IG5leHRfbG9jYXRpb259KTtcbiAgfSxcblxuICBjb21wb25lbnREaWRVcGRhdGU6IGZ1bmN0aW9uKHByZXZQcm9wcywgcHJldlN0YXRlKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0NhbnZhc0ZlYXQudXBkYXRlKGVsLCB0aGlzLnByb3BzLCB0aGlzLnN0YXRlKTtcblxuICB9LFxuXG4gIC8vIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gIC8vICAgcmV0dXJuIChcbiAgLy8gICAgIDxkaXYgY2xhc3NOYW1lPVwiY29udGFpbmVyXCI+XG4gIC8vICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm93XCI+XG4gIC8vICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb2wteHMtOFwiPlxuICAvLyAgICAgICAgICAgPGgzPnt0aGlzLnByb3BzLnRpdGxlfTwvaDM+XG4gIC8vICAgICAgICAgICA8aHIgLz5cbiAgLy8gICAgICAgICAgIDxkaXYgcmVmPVwiZDNcIj48L2Rpdj5cbiAgLy8gICAgICAgICA8L2Rpdj5cbiAgLy8gICAgICAgPC9kaXY+XG4gIC8vICAgICA8L2Rpdj5cbiAgLy8gICApO1xuICAvLyB9LFxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2PlxuICAgICAgICAgIDxoMz57dGhpcy5wcm9wcy50aXRsZX08L2gzPlxuICAgICAgICAgIDxociAvPlxuICAgICAgICAgIDxkaXYgcmVmPVwiZDNcIj48L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW52YXNGZWF0Q29udGFpbmVyO1xuIiwiLy8gdmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcbi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG52YXIgZDNDYW52YXNIZWF0ID0gcmVxdWlyZSgnLi9kM0NhbnZhc0hlYXQuanMnKTtcblxudmFyIENhbnZhc0hlYXRDb250YWluZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgbG9hZEpTT05Gcm9tU2VydmVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICB1cmw6IHRoaXMucHJvcHMudXJsLFxuICAgICAgICAgICAgZGF0YVR5cGU6ICdqc29uJyxcbiAgICAgICAgICAgIGNhY2hlOiBmYWxzZSxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFN0YXRlKHtkYXRhOiBkYXRhfSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksXG4gICAgICAgICAgICBlcnJvcjogZnVuY3Rpb24oeGhyLCBzdGF0dXMsIGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IodGhpcy5wcm9wcy51cmwsIHN0YXR1cywgZXJyLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpXG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtkYXRhOiBbXX07XG4gICAgfSxcbiAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IDQ4MCxcbiAgICAgIGhlaWdodDogMzYwLFxuICAgICAgc2NhbGU6IDIuMTQsXG4gICAgICBwaXhlbGF0ZWQ6IHRydWUsXG4gICAgICB5YmxvY2s6IDEsXG4gICAgICB4YmxvY2s6IDEsXG4gICAgICBncmlkOiBmYWxzZSxcbiAgICB9O1xuICB9LFxuXG4gIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmxvYWRKU09ORnJvbVNlcnZlcigpO1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNDYW52YXNIZWF0LmNyZWF0ZShlbCwgdGhpcy5wcm9wcywgdGhpcy5zdGF0ZSk7XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkVXBkYXRlOiBmdW5jdGlvbihwcmV2UHJvcHMsIHByZXZTdGF0ZSkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNDYW52YXNIZWF0LnVwZGF0ZShlbCwgdGhpcy5wcm9wcywgdGhpcy5zdGF0ZSk7XG4gIH0sXG5cbiAgLy8gcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgLy8gICByZXR1cm4gKFxuICAvLyAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXJcIj5cbiAgLy8gICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgLy8gICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy04XCI+XG4gIC8vICAgICAgICAgICA8aDM+e3RoaXMucHJvcHMudGl0bGV9PC9oMz5cbiAgLy8gICAgICAgICAgIDxociAvPlxuICAvLyAgICAgICAgICAgPGRpdiByZWY9XCJkM1wiPjwvZGl2PlxuICAvLyAgICAgICAgIDwvZGl2PlxuICAvLyAgICAgICA8L2Rpdj5cbiAgLy8gICAgIDwvZGl2PlxuICAvLyAgICk7XG4gIC8vIH0sXG4gIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXY+XG4gICAgICAgICAgPGgzPnt0aGlzLnByb3BzLnRpdGxlfTwvaDM+XG4gICAgICAgICAgPGhyIC8+XG4gICAgICAgICAgPGRpdiByZWY9XCJkM1wiPjwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfSxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbnZhc0hlYXRDb250YWluZXI7XG4iLCIvLyB2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdCcpO1xuLy8gdmFyIGQzID0gcmVxdWlyZSgnZDMnKTtcbnZhciBkM0ZlYXR1cmUgPSByZXF1aXJlKCcuL2QzRmVhdHVyZS5qcycpO1xuXG52YXIgRmVhdHVyZUNvbnRhaW5lciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IDk2MCxcbiAgICAgIGhlaWdodDogMjAwXG4gICAgfTtcbiAgfSxcblxuICBjb21wb25lbnREaWRNb3VudDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0ZlYXR1cmUuY3JlYXRlKGVsLCB7XG4gICAgICB3aWR0aDogdGhpcy5wcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogdGhpcy5wcm9wcy5oZWlnaHRcbiAgICB9LCB0aGlzLnN0YXRlKTtcbiAgfSxcblxuICBjb21wb25lbnREaWRVcGRhdGU6IGZ1bmN0aW9uKHByZXZQcm9wcywgcHJldlN0YXRlKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0ZlYXR1cmUudXBkYXRlKGVsLCB0aGlzLnN0YXRlKTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvd1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLThcIj5cbiAgICAgICAgICAgIDxoMz57dGhpcy5wcm9wcy50aXRsZX08L2gzPlxuICAgICAgICAgICAgPGhyIC8+XG4gICAgICAgICAgICA8ZGl2IHJlZj1cImQzXCI+PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfSxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEZlYXR1cmVDb250YWluZXI7XG4iLCIvLyB2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdCcpO1xuLy8gdmFyIGQzID0gcmVxdWlyZSgnZDMnKTtcbnZhciBkM0dyb3VwQmFyID0gcmVxdWlyZSgnLi9kM0dyb3VwQmFyLmpzJyk7XG5cbnZhciBHcm91cEJhckNvbnRhaW5lciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IDk2MCxcbiAgICAgIGhlaWdodDogMzAwLFxuICAgIH07XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNHcm91cEJhci5jcmVhdGUoZWwsIHtcbiAgICAgIHdpZHRoOiB0aGlzLnByb3BzLndpZHRoLFxuICAgICAgaGVpZ2h0OiB0aGlzLnByb3BzLmhlaWdodCxcbiAgICAgIGNzdjogdGhpcy5wcm9wcy5jc3ZcbiAgICB9LCB0aGlzLnN0YXRlKTtcbiAgfSxcblxuICBjb21wb25lbnREaWRVcGRhdGU6IGZ1bmN0aW9uKHByZXZQcm9wcywgcHJldlN0YXRlKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0dyb3VwQmFyLnVwZGF0ZShlbCwgdGhpcy5wcm9wcyk7XG4gIH0sXG5cbiAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy04XCI+XG4gICAgICAgICAgICA8aDM+e3RoaXMucHJvcHMudGl0bGV9PC9oMz5cbiAgICAgICAgICAgIDxociAvPlxuICAgICAgICAgICAgPGRpdiByZWY9XCJkM1wiPjwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBHcm91cEJhckNvbnRhaW5lcjtcbiIsIi8vIHZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0Jyk7XG4vLyB2YXIgZDMgPSByZXF1aXJlKCdkMycpO1xudmFyIGQzSEJhciA9IHJlcXVpcmUoJy4vZDNIQmFyLmpzJyk7XG5cbnZhciBIQmFyQ29udGFpbmVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICBnZXREZWZhdWx0UHJvcHM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogODAwLFxuICAgICAgaGVpZ2h0OiA1MDAsXG4gICAgfTtcbiAgfSxcblxuICBjb21wb25lbnREaWRNb3VudDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0hCYXIuY3JlYXRlKGVsLCB7XG4gICAgICB3aWR0aDogdGhpcy5wcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogdGhpcy5wcm9wcy5oZWlnaHQsXG4gICAgICBjc3Y6IHRoaXMucHJvcHMuY3N2XG4gICAgfSwgdGhpcy5zdGF0ZSk7XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkVXBkYXRlOiBmdW5jdGlvbihwcmV2UHJvcHMsIHByZXZTdGF0ZSkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNIQmFyLnVwZGF0ZShlbCwgdGhpcy5wcm9wcyk7XG4gIH0sXG5cbiAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy04XCI+XG4gICAgICAgICAgICA8aDM+e3RoaXMucHJvcHMudGl0bGV9PC9oMz5cbiAgICAgICAgICAgIDxociAvPlxuICAgICAgICAgICAgPGRpdiByZWY9XCJkM1wiPjwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBIQmFyQ29udGFpbmVyO1xuIiwiLy8gdmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcbi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG52YXIgZDNIZWF0ID0gcmVxdWlyZSgnLi9kM0hlYXQuanMnKTtcblxudmFyIEhlYXRDb250YWluZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiA4MDAsXG4gICAgICBoZWlnaHQ6IDUwMCxcbiAgICB9O1xuICB9LFxuXG4gIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZWwgPSBSZWFjdC5maW5kRE9NTm9kZSh0aGlzLnJlZnMuZDMpO1xuICAgIGQzSGVhdC5jcmVhdGUoZWwsIHtcbiAgICAgIHdpZHRoOiB0aGlzLnByb3BzLndpZHRoLFxuICAgICAgaGVpZ2h0OiB0aGlzLnByb3BzLmhlaWdodCxcbiAgICAgIGNzdjogdGhpcy5wcm9wcy5jc3ZcbiAgICB9LCB0aGlzLnN0YXRlKTtcbiAgfSxcblxuICBjb21wb25lbnREaWRVcGRhdGU6IGZ1bmN0aW9uKHByZXZQcm9wcywgcHJldlN0YXRlKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0hlYXQudXBkYXRlKGVsLCB0aGlzLnByb3BzKTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvd1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLThcIj5cbiAgICAgICAgICAgIDxoMz57dGhpcy5wcm9wcy50aXRsZX08L2gzPlxuICAgICAgICAgICAgPGhyIC8+XG4gICAgICAgICAgICA8ZGl2IHJlZj1cImQzXCI+PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfSxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEhlYXRDb250YWluZXI7XG4iLCIvLyB2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdCcpO1xuXG52YXIgZGl2U3R5bGUgPSB7XG4gICAgbWF4V2lkdGg6IFwiMTAwJVwiLFxuICAgIGhlaWdodDogXCJhdXRvXCJcbn07XG5cbnZhciBJbWFnZUNvbnRhaW5lciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXIgaW1hZ2VDb250YWluZXJcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvd1wiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy04XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8aDM+e3RoaXMucHJvcHMudGl0bGV9PC9oMz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLThcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxpbWcgc3R5bGU9e2RpdlN0eWxlfSBzcmM9e3RoaXMucHJvcHMudXJsfS8+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gSW1hZ2VDb250YWluZXI7XG4iLCIvLyB2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdCcpO1xuLy8gdmFyIGQzID0gcmVxdWlyZSgnZDMnKTtcbnZhciBkM0xldHRlcnMgPSByZXF1aXJlKCcuL2QzTGV0dGVycy5qcycpO1xuXG52YXIgTGV0dGVyc0NvbnRhaW5lciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IDk2MCxcbiAgICAgIGhlaWdodDogNTAwXG4gICAgfTtcbiAgfSxcblxuICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICBkYXRhOiB0aGlzLl9hbHBoYWJldFxuICAgIH07XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNMZXR0ZXJzLmNyZWF0ZShlbCwge1xuICAgICAgd2lkdGg6IHRoaXMucHJvcHMud2lkdGgsXG4gICAgICBoZWlnaHQ6IHRoaXMucHJvcHMuaGVpZ2h0XG4gICAgfSwgdGhpcy5zdGF0ZSk7XG5cbiAgICB0aGlzLmludGVydmFsID0gc2V0SW50ZXJ2YWwodGhpcy5fc2h1ZmZsZSwgNTAwMCk7XG4gIH0sXG5cbiAgX2FscGhhYmV0IDogXCJhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5elwiLnNwbGl0KFwiXCIpLFxuXG4gIF9zaHVmZmxlOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnNldFN0YXRlKHtkYXRhOiBkMy5zaHVmZmxlKHRoaXMuX2FscGhhYmV0KVxuICAgICAgICAgICAgICAgICAgLnNsaWNlKDAsIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDI1ICsgMSkpXG4gICAgICAgICAgICAgICAgICAuc29ydCgpfSk7XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkVXBkYXRlOiBmdW5jdGlvbihwcmV2UHJvcHMsIHByZXZTdGF0ZSkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNMZXR0ZXJzLnVwZGF0ZShlbCwgdGhpcy5zdGF0ZSk7XG4gIH0sXG5cbiAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy04XCI+XG4gICAgICAgICAgICA8aDM+e3RoaXMucHJvcHMudGl0bGV9PC9oMz5cbiAgICAgICAgICAgIDxociAvPlxuICAgICAgICAgICAgPGRpdiByZWY9XCJkM1wiPjwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBMZXR0ZXJzQ29udGFpbmVyO1xuIiwiLy8gdmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcbi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG52YXIgZDNMaW5lID0gcmVxdWlyZSgnLi9kM0xpbmUuanMnKTtcblxudmFyIExpbmVDb250YWluZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiA4MDAsXG4gICAgICBoZWlnaHQ6IDUwMCxcbiAgICB9O1xuICB9LFxuXG4gIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbigpIHtcbiAgICB2YXIgZWwgPSBSZWFjdC5maW5kRE9NTm9kZSh0aGlzLnJlZnMuZDMpO1xuICAgIGQzTGluZS5jcmVhdGUoZWwsIHtcbiAgICAgIHdpZHRoOiB0aGlzLnByb3BzLndpZHRoLFxuICAgICAgaGVpZ2h0OiB0aGlzLnByb3BzLmhlaWdodCxcbiAgICAgIGNzdjogdGhpcy5wcm9wcy5jc3ZcbiAgICB9LCB0aGlzLnN0YXRlKTtcbiAgfSxcblxuICBjb21wb25lbnREaWRVcGRhdGU6IGZ1bmN0aW9uKHByZXZQcm9wcywgcHJldlN0YXRlKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM0xpbmUudXBkYXRlKGVsLCB0aGlzLnByb3BzKTtcbiAgfSxcblxuICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lclwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvd1wiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLThcIj5cbiAgICAgICAgICAgIDxoMz57dGhpcy5wcm9wcy50aXRsZX08L2gzPlxuICAgICAgICAgICAgPGhyIC8+XG4gICAgICAgICAgICA8ZGl2IHJlZj1cImQzXCI+PC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfSxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IExpbmVDb250YWluZXI7XG4iLCIvLyB2YXIgUmVhY3QgPSByZXF1aXJlKCdyZWFjdCcpO1xuLy8gdmFyIGQzID0gcmVxdWlyZSgnZDMnKTtcbnZhciBkM01YUCA9IHJlcXVpcmUoJy4vZDNNWFAuanMnKTtcblxudmFyIEZlYXR1cmVDb250YWluZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gIGdldERlZmF1bHRQcm9wczogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiA5NjAsXG4gICAgICBoZWlnaHQ6IDQwMFxuICAgIH07XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNNWFAuY3JlYXRlKGVsLCB7XG4gICAgICB3aWR0aDogdGhpcy5wcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogdGhpcy5wcm9wcy5oZWlnaHRcbiAgICB9LCB0aGlzLnN0YXRlKTtcbiAgfSxcblxuICBjb21wb25lbnREaWRVcGRhdGU6IGZ1bmN0aW9uKHByZXZQcm9wcywgcHJldlN0YXRlKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM01YUC51cGRhdGUoZWwsIHRoaXMuc3RhdGUpO1xuICB9LFxuXG4gIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29udGFpbmVyXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm93XCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb2wteHMtOFwiPlxuICAgICAgICAgICAgPGgzPnt0aGlzLnByb3BzLnRpdGxlfTwvaDM+XG4gICAgICAgICAgICA8aHIgLz5cbiAgICAgICAgICAgIDxkaXYgcmVmPVwiZDNcIj48L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9LFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmVhdHVyZUNvbnRhaW5lcjtcbiIsIi8vIHZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0Jyk7XG52YXIgTWFya2Rvd25Gb3JtID0gcmVxdWlyZSgnLi9NYXJrZG93bkZvcm0uanMnKTtcbnZhciBNYXJrZG93bkxpc3QgPSByZXF1aXJlKCcuL01hcmtkb3duTGlzdC5qcycpO1xuXG52YXIgTWFya2Rvd25Db250YWluZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgbG9hZEpTT05Gcm9tU2VydmVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICQuYWpheCh7XG4gICAgICAgICAgICB1cmw6IHRoaXMucHJvcHMudXJsLFxuICAgICAgICAgICAgZGF0YVR5cGU6ICdqc29uJyxcbiAgICAgICAgICAgIGNhY2hlOiBmYWxzZSxcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFN0YXRlKHtkYXRhOiBkYXRhfSk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyksXG4gICAgICAgICAgICBlcnJvcjogZnVuY3Rpb24oeGhyLCBzdGF0dXMsIGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IodGhpcy5wcm9wcy51cmwsIHN0YXR1cywgZXJyLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgaGFuZGxlTWFya2Rvd25TdWJtaXQ6IGZ1bmN0aW9uKG1hcmtkb3duKSB7XG4gICAgICAgIHZhciBtYXJrZG93bnMgPSB0aGlzLnN0YXRlLmRhdGE7XG4gICAgICAgIHZhciBuZXdNYXJrZG93bnMgPSBtYXJrZG93bnMuY29uY2F0KFttYXJrZG93bl0pO1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtkYXRhOiBuZXdNYXJrZG93bnN9KTtcbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHVybDogdGhpcy5wcm9wcy51cmwsXG4gICAgICAgICAgICBkYXRhVHlwZTogJ2pzb24nLFxuICAgICAgICAgICAgdHlwZTogJ1BPU1QnLFxuICAgICAgICAgICAgZGF0YTogbWFya2Rvd24sXG4gICAgICAgICAgICBzdWNjZXNzOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7ZGF0YTogZGF0YX0pO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgZXJyb3I6IGZ1bmN0aW9uKHhociwgc3RhdHVzLCBlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKHRoaXMucHJvcHMudXJsLCBzdGF0dXMsIGVyci50b1N0cmluZygpKTtcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKVxuICAgICAgICB9KTtcbiAgICB9LCBcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtkYXRhOiBbXX07XG4gICAgfSxcbiAgICBnZXREZWZhdWx0UHJvcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtwb2xsSW50ZXJ2YWw6IG51bGx9O1xuICAgIH0sXG4gICAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmxvYWRKU09ORnJvbVNlcnZlcigpO1xuICAgICAgICBpZiAodGhpcy5wcm9wcy5wb2xsSW50ZXJ2YWwpIHtcbiAgICAgICAgICAgIHNldEludGVydmFsKHRoaXMubG9hZEpTT05Gcm9tU2VydmVyLCB0aGlzLnByb3BzLnBvbGxJbnRlcnZhbCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbnRhaW5lclwiPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdtYXJrZG93bkJveCc+XG4gICAgICAgICAgICAgICAgICAgIDxoMz57dGhpcy5wcm9wcy50aXRsZX08L2gzPlxuICAgICAgICAgICAgICAgICAgICA8aHIgLz5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLThcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8TWFya2Rvd25MaXN0IGRhdGE9e3RoaXMuc3RhdGUuZGF0YX0vPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy00XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPE1hcmtkb3duRm9ybSB0aXRsZT17dGhpcy5wcm9wcy50aXRsZX0gb25NYXJrZG93blN1Ym1pdD17dGhpcy5oYW5kbGVNYXJrZG93blN1Ym1pdH0gLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcmtkb3duQ29udGFpbmVyO1xuIiwiLy8gdmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcbi8vIHZhciBtYXJrZWQgPSByZXF1aXJlKCdtYXJrZWQnKTtcbnJlcXVpcmUoJ21hcmtlZCcpO1xucmVxdWlyZSgnLi9kM1RhYmxlLmxlc3MnKTtcblxudmFyIE1hcmtkb3duRmlndXJlID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIG1hcmtlZC5zZXRPcHRpb25zKHtcbiAgICAgICAgICAgIGhpZ2hsaWdodDogZnVuY3Rpb24gKGNvZGUpIHtcbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gcmVxdWlyZSgnaGlnaGxpZ2h0LmpzJykuaGlnaGxpZ2h0QXV0byhjb2RlKS52YWx1ZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGxqcy5oaWdobGlnaHRBdXRvKGNvZGUpLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgdmFyIHJhd01hcmt1cCA9IG1hcmtlZCh0aGlzLnByb3BzLmNoaWxkcmVuLnRvU3RyaW5nKCksIHtzYW5pdGl6ZTogdHJ1ZSwgYnJlYWtzOiB0cnVlfSk7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ncm93Jz5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTEyJz5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J21hcmtkb3duJz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxoNyBjbGFzc05hbWU9J21hcmtkb3duVGl0bGUnPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt0aGlzLnByb3BzLnRpdGxlfVxuICAgICAgICAgICAgICAgICAgICAgICAgPC9oNz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGRhbmdlcm91c2x5U2V0SW5uZXJIVE1MPXt7X19odG1sOiByYXdNYXJrdXB9fSAvPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcmtkb3duRmlndXJlO1xuIiwiLy8gdmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcblxudmFyIE1hcmtkb3duRm9ybSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBoYW5kbGVTdWJtaXQ6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB2YXIgdGl0bGUgPSBSZWFjdC5maW5kRE9NTm9kZSh0aGlzLnJlZnMudGl0bGUpLnZhbHVlLnRyaW0oKTtcbiAgICAgICAgdmFyIHRleHQgPSBSZWFjdC5maW5kRE9NTm9kZSh0aGlzLnJlZnMudGV4dCkudmFsdWUudHJpbSgpO1xuICAgICAgICBpZiAoIXRleHQgfHwgIXRpdGxlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wcm9wcy5vbk1hcmtkb3duU3VibWl0KHt0aXRsZTogdGl0bGUsIHRleHQ6IHRleHR9KTtcbiAgICAgICAgUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLnRpdGxlKS52YWx1ZSA9ICcnO1xuICAgICAgICBSZWFjdC5maW5kRE9NTm9kZSh0aGlzLnJlZnMudGV4dCkudmFsdWUgPSAnJztcbiAgICAgICAgcmV0dXJuO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGRpdlN0eWxlID0ge3dpZHRoOiAnMTAwJSd9O1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICA8aDc+XG4gICAgICAgICAgICAgICAgICAgIEFkZCB7dGhpcy5wcm9wcy50aXRsZS50b0xvd2VyQ2FzZSgpfVxuICAgICAgICAgICAgICAgIDwvaDc+XG4gICAgICAgICAgICAgICAgPGZvcm0gY2xhc3NOYW1lPSdtYXJrZG93bkZvcm0nIG9uU3VibWl0PXt0aGlzLmhhbmRsZVN1Ym1pdH0+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicm93XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy0xMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCBzdHlsZT17ZGl2U3R5bGV9IHR5cGU9XCJ0ZXh0XCIgcmVmPVwidGl0bGVcIiBwbGFjZWhvbGRlcj1cIiAgIFRpdGxlXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLTEyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhIHN0eWxlPXtkaXZTdHlsZX0gdHlwZT1cInRleHRcIiByZWY9XCJ0ZXh0XCIgcGxhY2Vob2xkZXI9XCJNYXJrZG93biB0ZXh0Li4uXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29sLXhzLTEyXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9J2J0biBidG4tcHJpbWFyeScgdHlwZT0nc3VibWl0Jz5Qb3N0PC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9mb3JtPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gTWFya2Rvd25Gb3JtO1xuIiwiLy8gdmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcbnZhciBNYXJrZG93bkZpZ3VyZSA9IHJlcXVpcmUoJy4vTWFya2Rvd25GaWd1cmUuanMnKTtcblxudmFyIE1hcmtkb3duTGlzdCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbWFya2Rvd25Ob2RlcyA9IHRoaXMucHJvcHMuZGF0YS5tYXAoZnVuY3Rpb24gKG1hcmtkb3duKSB7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIDxNYXJrZG93bkZpZ3VyZSB0aXRsZT17bWFya2Rvd24udGl0bGV9PlxuICAgICAgICAgICAgICAgICAgICB7bWFya2Rvd24udGV4dH1cbiAgICAgICAgICAgICAgICA8L01hcmtkb3duRmlndXJlPlxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nbWFya2Rvd25MaXN0Jz5cbiAgICAgICAgICAgICAgICB7bWFya2Rvd25Ob2Rlc31cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hcmtkb3duTGlzdDtcbiIsIi8vIHZhciBSZWFjdCA9IHJlcXVpcmUoJ3JlYWN0Jyk7XG4vLyB2YXIgZDMgPSByZXF1aXJlKCdkMycpO1xudmFyIGQzU3RhY2tlZEJhciA9IHJlcXVpcmUoJy4vZDNTdGFja2VkQmFyLmpzJyk7XG5cbnZhciBTdGFja2VkQmFyQ29udGFpbmVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICBnZXREZWZhdWx0UHJvcHM6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICB3aWR0aDogOTYwLFxuICAgICAgaGVpZ2h0OiA1MDAsXG4gICAgfTtcbiAgfSxcblxuICBjb21wb25lbnREaWRNb3VudDogZnVuY3Rpb24oKSB7XG4gICAgdmFyIGVsID0gUmVhY3QuZmluZERPTU5vZGUodGhpcy5yZWZzLmQzKTtcbiAgICBkM1N0YWNrZWRCYXIuY3JlYXRlKGVsLCB7XG4gICAgICB3aWR0aDogdGhpcy5wcm9wcy53aWR0aCxcbiAgICAgIGhlaWdodDogdGhpcy5wcm9wcy5oZWlnaHQsXG4gICAgICBjc3Y6IHRoaXMucHJvcHMuY3N2XG4gICAgfSwgdGhpcy5zdGF0ZSk7XG4gIH0sXG5cbiAgY29tcG9uZW50RGlkVXBkYXRlOiBmdW5jdGlvbihwcmV2UHJvcHMsIHByZXZTdGF0ZSkge1xuICAgIHZhciBlbCA9IFJlYWN0LmZpbmRET01Ob2RlKHRoaXMucmVmcy5kMyk7XG4gICAgZDNTdGFja2VkQmFyLnVwZGF0ZShlbCwgdGhpcy5wcm9wcyk7XG4gIH0sXG5cbiAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXJcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3dcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImNvbC14cy04XCI+XG4gICAgICAgICAgICA8aDM+e3RoaXMucHJvcHMudGl0bGV9PC9oMz5cbiAgICAgICAgICAgIDxociAvPlxuICAgICAgICAgICAgPGRpdiByZWY9XCJkM1wiPjwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGFja2VkQmFyQ29udGFpbmVyO1xuIiwiLy8gdmFyIFJlYWN0ID0gcmVxdWlyZSgncmVhY3QnKTtcblxuXG52YXIgQ2FudmFzRmVhdENvbnRhaW5lciA9IHJlcXVpcmUoJy4vQ2FudmFzRmVhdENvbnRhaW5lci5qcycpO1xudmFyIEZlYXR1cmVDb250YWluZXIgPSByZXF1aXJlKCcuL0ZlYXR1cmVDb250YWluZXIuanMnKTtcbnZhciBJbWFnZUNvbnRhaW5lciA9IHJlcXVpcmUoJy4vSW1hZ2VDb250YWluZXIuanMnKTtcbnZhciBDYW52YXNIZWF0Q29udGFpbmVyID0gcmVxdWlyZSgnLi9DYW52YXNIZWF0Q29udGFpbmVyLmpzJyk7XG52YXIgSGVhdENvbnRhaW5lciA9IHJlcXVpcmUoJy4vSGVhdENvbnRhaW5lci5qcycpO1xudmFyIExpbmVDb250YWluZXIgPSByZXF1aXJlKCcuL0xpbmVDb250YWluZXIuanMnKTtcbnZhciBTdGFja2VkQmFyQ29udGFpbmVyID0gcmVxdWlyZSgnLi9TdGFja2VkQmFyQ29udGFpbmVyLmpzJyk7XG52YXIgR3JvdXBCYXJDb250YWluZXIgPSByZXF1aXJlKCcuL0dyb3VwQmFyQ29udGFpbmVyLmpzJyk7XG52YXIgSEJhckNvbnRhaW5lciA9IHJlcXVpcmUoJy4vSEJhckNvbnRhaW5lci5qcycpO1xudmFyIEJhckNvbnRhaW5lciA9IHJlcXVpcmUoJy4vQmFyQ29udGFpbmVyLmpzJyk7XG52YXIgTGV0dGVyc0NvbnRhaW5lciA9IHJlcXVpcmUoJy4vTGV0dGVyc0NvbnRhaW5lci5qcycpO1xudmFyIE1hcmtkb3duQ29udGFpbmVyID0gcmVxdWlyZSgnLi9NYXJrZG93bkNvbnRhaW5lci5qcycpO1xudmFyIE1YUENvbnRhaW5lciA9IHJlcXVpcmUoJy4vTVhQQ29udGFpbmVyLmpzJyk7XG5cblJlYWN0LnJlbmRlcihcbiAgICA8ZGl2PlxuICAgICAgICAgICAgey8qXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb250YWluZXInPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3Jvdyc+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPENhbnZhc0ZlYXRDb250YWluZXIgdXJsPScvbGVubmFfcmF3Lmpzb24nIHBlcmNlbnQ9J3RydWUnIG1vdmU9J3RydWUnIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAqL31cbiAgICAgICAgICAgIHsvKlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3Jvdyc+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPE1YUENvbnRhaW5lci8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdyb3cnPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtNCc+XG4gICAgICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIGdyZXk9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXsxfSAgdXJsPScvbGVubmFfcmF3Lmpzb24nIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPENhbnZhc0hlYXRDb250YWluZXIgZ3JleT17dHJ1ZX0geWJsb2NrPXsxfSB4YmxvY2s9ezF9ICB1cmw9Jy9sZW5uYV9zdGFnZS5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtNCc+XG4gICAgICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIGdyZXk9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXs0fSAgdXJsPScvbGVubmFfc3RhZ2UuanNvbicgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3Jvdyc+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPENhbnZhc0hlYXRDb250YWluZXIgZ3JleT17dHJ1ZX0geWJsb2NrPXsxfSB4YmxvY2s9ezEwMDB9IHVybD0nL2xlbm5hX3N0YWdlLmpzb24nIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPENhbnZhc0hlYXRDb250YWluZXIgZ3JleT17dHJ1ZX0geWJsb2NrPXsxNn0geGJsb2NrPXsxNn0gdXJsPScvbGVubmFfc3RhZ2UuanNvbicgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTQnPlxuICAgICAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciBncmV5PXt0cnVlfSBsZWdlbmQ9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXszMn0gdXJsPScvbGVubmFfc3RhZ2UuanNvbicgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPEZlYXR1cmVDb250YWluZXIgdGl0bGU9J0ZlYXR1cmUnLz5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbnRhaW5lcic+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ncm93Jz5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTQnPlxuICAgICAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciBncmV5PXt0cnVlfSB5YmxvY2s9ezF9IHhibG9jaz17MX0gIHVybD0nL2xlbm5hX3Jhdy5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtNCc+XG4gICAgICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIGdyZXk9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXsxfSAgdXJsPScvbGVubmFfZmVhdC5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtNCc+XG4gICAgICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIGdyZXk9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXs0fSAgdXJsPScvbGVubmFfZmVhdC5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ncm93Jz5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTQnPlxuICAgICAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciBncmV5PXt0cnVlfSB5YmxvY2s9ezF9IHhibG9jaz17MTAwMH0gdXJsPScvbGVubmFfZmVhdC5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtNCc+XG4gICAgICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIGdyZXk9e3RydWV9IHlibG9jaz17MTZ9IHhibG9jaz17MTZ9IHVybD0nL2xlbm5hX2ZlYXQuanNvbicgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTQnPlxuICAgICAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciBncmV5PXt0cnVlfSBsZWdlbmQ9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXszMn0gdXJsPScvbGVubmFfZmVhdC5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29udGFpbmVyJz5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdyb3cnPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtMyc+XG4gICAgICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIGdyZXk9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXsxfSAgdXJsPScvbGVubmFfcmF3Lmpzb24nIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy0zJz5cbiAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciBncmV5PXt0cnVlfSB5YmxvY2s9ezF9IHhibG9jaz17MX0gIHVybD0nL2xlbm5hX2ZlYXQuanNvbicgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTMnPlxuICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIGdyZXk9e3RydWV9IHlibG9jaz17NH0geGJsb2NrPXs0fSAgdXJsPScvbGVubmFfZmVhdC5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0ncm93Jz5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTMnPlxuICAgICAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciB3aWR0aD17NDIwfSBncmV5PXt0cnVlfSB5YmxvY2s9ezF9IHhibG9jaz17MX0gIHVybD0nL2xlbm5hX3Jhdy5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtMyc+XG4gICAgICAgICAgICAgICAgICAgIDxDYW52YXNIZWF0Q29udGFpbmVyIHdpZHRoPXs0MjB9IGdyZXk9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXsxfSB1cmw9Jy9sZW5uYV9mZWF0Lmpzb24nIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy0zJz5cbiAgICAgICAgICAgICAgICAgICAgPENhbnZhc0hlYXRDb250YWluZXIgd2lkdGg9ezQyMH0gZ3JleT17dHJ1ZX0geWJsb2NrPXsxfSB4YmxvY2s9ezEwMDB9IHVybD0nL2xlbm5hX2ZlYXQuanNvbicgLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTMnPlxuICAgICAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciB3aWR0aD17NDIwfSBncmV5PXt0cnVlfSBsZWdlbmQ9e3RydWV9IHlibG9jaz17MX0geGJsb2NrPXs2NH0gdXJsPScvbGVubmFfZmVhdC5qc29uJyAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb250YWluZXInPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3Jvdyc+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPGgzPlxuICAgICAgICAgICAgICAgICAgICAgICAgTEJQIENlbGwgU2l6ZXNcbiAgICAgICAgICAgICAgICAgICAgPC9oMz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J3Jvdyc+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPENhbnZhc0hlYXRDb250YWluZXIgcGVyY2VudD17dHJ1ZX0gZ3JpZD17dHJ1ZX0gYXhpcz17dHJ1ZX0gdXJsPScvdGVzdC5qc29uJy8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9J2NvbC14cy00Jz5cbiAgICAgICAgICAgICAgICAgICAgPENhbnZhc0hlYXRDb250YWluZXIgcGVyY2VudD17dHJ1ZX0gZ3JpZD17dHJ1ZX0gYXhpcz17dHJ1ZX0gdXJsPScvdGVzdF9yLmpzb24nLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29sLXhzLTQnPlxuICAgICAgICAgICAgICAgICAgICA8Q2FudmFzSGVhdENvbnRhaW5lciBwZXJjZW50PXt0cnVlfSBncmlkPXt0cnVlfSBheGlzPXt0cnVlfSB1cmw9Jy90ZXN0X3IyLmpzb24nIGxlZ2VuZD17dHJ1ZX0gLz5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgICAgPEltYWdlQ29udGFpbmVyIHRpdGxlPSdGaWx0ZXJpbmcgRmFjZXMnIHVybD0nL2ZhY2VzLnBuZycgLz5cbiAgICAgICAgPEltYWdlQ29udGFpbmVyIHRpdGxlPSdDYXNjYWRlIFJlc3VsdHMnIHVybD0nL2Nhc2NhZGVzLmpwZycgLz5cbiAgICAgICAgPEhlYXRDb250YWluZXIgdGl0bGU9J0hlYXQnIGNzdj0naGVhdG1hcC5jc3YnIC8+XG4gICAgICAgICovfVxuICAgICAgICA8R3JvdXBCYXJDb250YWluZXIgdGl0bGU9J1BlcmZvcm1hbmNlIChtcyknIGNzdj0nL3pwZXJmb3JtYW5jZTQuY3N2JyAvPlxuICAgICAgICB7LypcbiAgICAgICAgPEdyb3VwQmFyQ29udGFpbmVyIHRpdGxlPSdQZXJmb3JtYW5jZSAvIEFyZWEnIGNzdj0nL3phcmVhLmNzdicgLz5cbiAgICAgICAgPFN0YWNrZWRCYXJDb250YWluZXIgdGl0bGU9J1N0YWNrZWQgQmFyIENoYXJ0JyBjc3Y9J3BvcHVsYXRpb24uY3N2JyAvPlxuICAgICAgICA8TGluZUNvbnRhaW5lciB0aXRsZT0nU2ltcGxlIExpbmUgQ2hhcnQnIGNzdj0nbGluZS5jc3YnIC8+XG4gICAgICAgIDxCYXJDb250YWluZXIgdGl0bGU9J1NpbXBsZSBCYXIgQ2hhcnQnIGNzdj0nbGV0dGVycy5jc3YnIC8+XG4gICAgICAgIDxIQmFyQ29udGFpbmVyIHRpdGxlPSdTaW1wbGUgSEJhciBDaGFydCcgY3N2PSdsZXR0ZXJzLmNzdicgLz5cbiAgICAgICAgPExldHRlcnNDb250YWluZXIgdGl0bGU9J0dlbmVyYWwgdXBkYXRlIHBhdHRlcm4nIHdpZHRoPScxMDAlJyBoZWlnaHQ9JzAnLz5cbiAgICAgICAgPE1hcmtkb3duQ29udGFpbmVyIHRpdGxlPSdDb2RlJyB1cmw9J2RhdGEvY29kZS5qc29uJy8+XG4gICAgICAgIDxNYXJrZG93bkNvbnRhaW5lciB0aXRsZT0nVGFibGVzJyB1cmw9J2RhdGEvdGFibGVzLmpzb24nLz5cbiAgICAgICAgKi99XG4gICAgPC9kaXY+LFxuICAgIGRvY3VtZW50LmJvZHlcbik7XG5cbi8vIFJlYWN0LnJlbmRlcihcbi8vICAgICA8ZGl2PlxuLy8gICAgICAgICA8ZGl2IGNsYXNzTmFtZT0nY29udGFpbmVyJz5cbi8vICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdyb3cnPlxuLy8gICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPSdjb2wteHMtMTInPlxuLy8gICAgICAgICAgICAgICAgICAgICA8aDE+XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICBDdXN0XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJmdWktaGVhcnRcIj48L3NwYW4+XG4vLyAgICAgICAgICAgICAgICAgICAgICAgICBtIENhcmRzIGJ5IFJlaVxuLy8gICAgICAgICAgICAgICAgICAgICA8L2gxPlxuLy8gICAgICAgICAgICAgICAgIDwvZGl2PlxuLy8gICAgICAgICAgICAgPC9kaXY+XG4vLyAgICAgICAgIDwvZGl2PlxuLy8gICAgICAgICA8TWFya2Rvd25Db250YWluZXIgdGl0bGU9XCJSZXZpZXdzXCIgdXJsPSdkYXRhL2NhcmRzLmpzb24nLz5cbi8vICAgICAgICAgPExpbmVDb250YWluZXIgdGl0bGU9J1NhbGVzJyBjc3Y9J2xpbmUyLmNzdicgLz5cbi8vICAgICA8L2Rpdj4sXG4vLyAgICAgZG9jdW1lbnQuYm9keVxuLy8gKTtcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyB2YXIgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCJ0ZXh0LmF4aXMsLmF4aXMgdGV4dHtmb250OjE4cHggc2Fucy1zZXJpZiAhaW1wb3J0YW50fS5heGlzIHBhdGgsLmF4aXMgbGluZXtmaWxsOm5vbmU7c3Ryb2tlOiMwMDA7c2hhcGUtcmVuZGVyaW5nOmNyaXNwRWRnZXN9LnguYXhpcyBwYXRoe2Rpc3BsYXk6bm9uZX1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG5cbnJlcXVpcmUoJy4vZDNCYXIubGVzcycpO1xucmVxdWlyZSgnLi9kM0F4aXMubGVzcycpO1xuXG52YXIgbnMgPSB7fTtcblxubnMuX21hcmdpbiA9IHt0b3A6IDIwLCByaWdodDogMzAsIGJvdHRvbTogMzAsIGxlZnQ6IDQwfTsgXG5cbm5zLl93aWR0aCA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy53aWR0aCAtIHRoaXMuX21hcmdpbi5sZWZ0IC0gdGhpcy5fbWFyZ2luLnJpZ2h0O1xufVxuXG5ucy5faGVpZ2h0ID0gZnVuY3Rpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLmhlaWdodCAtIHRoaXMuX21hcmdpbi50b3AgLSB0aGlzLl9tYXJnaW4uYm90dG9tO1xufVxuXG5ucy5jcmVhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMsIHN0YXRlKSB7XG5cbiAgZDMuc2VsZWN0KGVsKS5hcHBlbmQoJ3N2ZycpXG4gICAgLmF0dHIoJ3dpZHRoJywgcHJvcHMud2lkdGgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIHByb3BzLmhlaWdodClcbiAgICAuYXBwZW5kKCdnJylcbiAgICAuYXR0cignY2xhc3MnLCAnY2hhcnQnKVxuICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB0aGlzLl9tYXJnaW4ubGVmdCArICcsJyArIHRoaXMuX21hcmdpbi50b3AgKyAnKScpO1xuXG4gIHRoaXMudXBkYXRlKGVsLCBwcm9wcyk7XG59XG5cbm5zLl9heGlzID0gZnVuY3Rpb24oc2NhbGVzKSB7XG4gIHZhciB4ID0gZDMuc3ZnLmF4aXMoKVxuICAgICAgICAgICAgICAuc2NhbGUoc2NhbGVzLngpXG4gICAgICAgICAgICAgIC5vcmllbnQoJ2JvdHRvbScpO1xuXG4gIHZhciB5ID0gZDMuc3ZnLmF4aXMoKVxuICAgICAgICAgICAgICAuc2NhbGUoc2NhbGVzLnkpXG4gICAgICAgICAgICAgIC5vcmllbnQoJ2xlZnQnKVxuICAgICAgICAgICAgICAudGlja3MoMTAsICclJyk7XG5cbiAgcmV0dXJuIHt4OiB4LCB5OiB5fTtcbn1cblxubnMuX3NjYWxlcyA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHdpZHRoID0gdGhpcy5fd2lkdGgocHJvcHMpO1xuICBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuXG4gIHZhciB5ID0gZDMuc2NhbGUubGluZWFyKClcbiAgICAgICAgICAucmFuZ2UoW2hlaWdodCwgMF0pO1xuICB2YXIgeCA9IGQzLnNjYWxlLm9yZGluYWwoKVxuICAgICAgICAgIC5yYW5nZVJvdW5kQmFuZHMoWzAsIHdpZHRoXSwgLjEpO1xuXG4gIHJldHVybiB7eDogeCwgeTogeX07XG59XG5cbm5zLnVwZGF0ZSA9IGZ1bmN0aW9uKGVsLCBwcm9wcykge1xuICB2YXIgd2lkdGggPSB0aGlzLl93aWR0aChwcm9wcyk7XG4gIHZhciBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuICB2YXIgc2NhbGVzID0gdGhpcy5fc2NhbGVzKHByb3BzKTtcbiAgdmFyIGF4aXMgPSB0aGlzLl9heGlzKHNjYWxlcyk7XG5cbiAgZDMuY3N2KHByb3BzLmNzdiwgdHlwZSwgZnVuY3Rpb24gKGVycm9yLCBkYXRhKSB7XG5cbiAgICBzY2FsZXMueC5kb21haW4oZGF0YS5tYXAoZnVuY3Rpb24oZCkge3JldHVybiBkLm5hbWU7IH0pKTtcbiAgICBzY2FsZXMueS5kb21haW4oWzAsIGQzLm1heChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLnZhbHVlOyB9KV0pO1xuICAgIHZhciBjaGFydCA9IGQzLnNlbGVjdChlbCkuc2VsZWN0KCcuY2hhcnQnKTtcblxuICAgIGNoYXJ0LmFwcGVuZCgnZycpXG4gICAgICAuYXR0cignY2xhc3MnLCAneCBheGlzJylcbiAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsIFwiICsgaGVpZ2h0ICsgXCIpXCIpXG4gICAgICAuY2FsbChheGlzLngpO1xuXG4gICAgY2hhcnQuYXBwZW5kKFwiZ1wiKVxuICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInkgYXhpc1wiKVxuICAgICAgLmNhbGwoYXhpcy55KVxuICAgICAgLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3JvdGF0ZSgtOTApJylcbiAgICAgIC5hdHRyKCd5JywgNilcbiAgICAgIC5hdHRyKCdkeScsICcuNzFlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ2VuZCcpXG4gICAgICAudGV4dCgnRnJlcXVlbmN5Jyk7XG5cblxuICAgIC8vIGRhdGEgam9pbiAoZW50ZXIgb25seSlcbiAgICB2YXIgYmFyID0gY2hhcnQuc2VsZWN0QWxsKCcuYmFyJylcbiAgICAgICAgICAgLmRhdGEoZGF0YSlcbiAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2JhcicpXG4gICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkLCBpKSB7IHJldHVybiBcInRyYW5zbGF0ZShcIiArIHNjYWxlcy54KGQubmFtZSkgKyBcIiwgMClcIjsgfSk7XG5cbiAgICBiYXIuYXBwZW5kKCdyZWN0JylcbiAgICAgICAgLmF0dHIoXCJ5XCIsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIHNjYWxlcy55KGQudmFsdWUpOyB9KVxuICAgICAgICAuYXR0cihcImhlaWdodFwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBoZWlnaHQgLSBzY2FsZXMueShkLnZhbHVlKTsgfSlcbiAgICAgICAgLmF0dHIoXCJ3aWR0aFwiLCBzY2FsZXMueC5yYW5nZUJhbmQoKSAtIDEpO1xuXG4gICAgYmFyLmFwcGVuZCgndGV4dCcpXG4gICAgICAgIC5hdHRyKFwieFwiLCBzY2FsZXMueC5yYW5nZUJhbmQoKSAvIDIpXG4gICAgICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBzY2FsZXMueShkLnZhbHVlKSArIDM7IH0pXG4gICAgICAgIC5hdHRyKFwiZHlcIiwgXCIuNzVlbVwiKVxuICAgICAgICAudGV4dChmdW5jdGlvbihkKSB7cmV0dXJuIE1hdGgucm91bmQoZC52YWx1ZSAqIDEwMDApLzEwLjA7fSk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHR5cGUoZCkge1xuICAgIGQudmFsdWUgPSArZC52YWx1ZTsgLy9jb2VyY2UgdG8gbnVtYmVyXG4gICAgcmV0dXJuIGQ7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRfcGVyY2VudChkLCBuKSB7XG4gICAgcGVyY2VudCA9ICsoZC5zcGxpdChcIiVcIilbMF0pXG4gICAgbmV3UGVyY2VudCA9IHBlcmNlbnQgKyBuXG4gICAgcmV0dXJuIFwiXCIgKyBuZXdQZXJjZW50ICsgXCIlXCI7XG4gIH1cbn07XG5cbm5zLmRlc3Ryb3kgPSBmdW5jdGlvbihlbCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gbnM7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLmJhciByZWN0e2ZpbGw6c3RlZWxibHVlfS5iYXI6aG92ZXIgcmVjdHtmaWxsOm9yYW5nZX0uYmFyIHRleHR7dmlzaWJpbGl0eTpoaWRkZW4gIWltcG9ydGFudDtmaWxsOndoaXRlICFpbXBvcnRhbnQ7Zm9udDoxMHB4IHNhbnMtc2VyaWYgIWltcG9ydGFudDt0ZXh0LWFuY2hvcjptaWRkbGUgIWltcG9ydGFudH0uYmFyOmhvdmVyIHRleHR7dmlzaWJpbGl0eTp2aXNpYmxlICFpbXBvcnRhbnR9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCIvLyB2YXIgZDMgPSByZXF1aXJlKCdkMycpO1xuXG5yZXF1aXJlKCcuL2QzUG9zLmxlc3MnKTtcbnJlcXVpcmUoJy4vZDNBeGlzLmxlc3MnKTtcblxudmFyIG5zID0ge307XG5cbm5zLl9tYXJnaW4gPSB7dG9wOiAyMCwgcmlnaHQ6IDkwLCBib3R0b206IDMwLCBsZWZ0OiA1MH07IFxuXG5ucy5fd2lkdGggPSBmdW5jdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMud2lkdGggLSB0aGlzLl9tYXJnaW4ubGVmdCAtIHRoaXMuX21hcmdpbi5yaWdodDtcbn1cblxubnMuX2hlaWdodCA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5oZWlnaHQgLSB0aGlzLl9tYXJnaW4udG9wIC0gdGhpcy5fbWFyZ2luLmJvdHRvbTtcbn1cblxubnMuX2ltZyA9IG5ldyBJbWFnZSgpLFxubnMuX2ltZ1JlYWR5ID0gZmFsc2UsXG5cbm5zLmNyZWF0ZSA9IGZ1bmN0aW9uKGVsLCBwcm9wcywgc3RhdGUpIHtcbiAgY29uc29sZS5sb2cobnMuX2ltZ1JlYWR5KTtcbiAgbnMuX2ltZy5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICBucy5faW1nUmVhZHkgPSB0cnVlO1xuICAgIGNvbnNvbGUubG9nKG5zLl9pbWdSZWFkeSk7XG4gIH1cbiAgbnMuX2ltZy5zcmMgPSAnbGVubmEucG5nJztcblxuICBjb250YWluZXIgPSBkMy5zZWxlY3QoZWwpLmFwcGVuZCgnZGl2JylcbiAgICAuYXR0cignY2xhc3MnLCAncmVsJylcbiAgICAuc3R5bGUoJ3dpZHRoJywgcHJvcHMud2lkdGggKyBcInB4XCIpXG4gICAgLnN0eWxlKCdoZWlnaHQnLCBwcm9wcy5oZWlnaHQgKyBcInB4XCIpXG5cblxuICAvLyBjb250YWluZXIuYXBwZW5kKCdkaXYnKVxuICAvLyAuYXR0cignY2xhc3MnLCAnYWJzJylcbiAgLy8gICAuc3R5bGUoJ3dpZHRoJywgdGhpcy5fd2lkdGgocHJvcHMpICsgXCJweFwiKVxuICAvLyAgIC5zdHlsZSgnaGVpZ2h0JywgdGhpcy5faGVpZ2h0KHByb3BzKSArIFwicHhcIilcbiAgLy8gLnN0eWxlKCdsZWZ0JywgdGhpcy5fbWFyZ2luLmxlZnQgKyBcInB4XCIpXG4gIC8vIC5zdHlsZSgndG9wJywgdGhpcy5fbWFyZ2luLnRvcCArIFwicHhcIilcbiAgLy8gICAuYXBwZW5kKCdjYW52YXMnKVxuICAvLyAgIC5zdHlsZSgnd2lkdGgnLCB0aGlzLl93aWR0aChwcm9wcykvMiArIFwicHhcIilcbiAgLy8gICAuc3R5bGUoJ2hlaWdodCcsIHRoaXMuX2hlaWdodChwcm9wcykgKyBcInB4XCIpXG4gIC8vICAgLmF0dHIoJ2NsYXNzJywgJ2ltYWdlIGFicycpO1xuXG4gIGZhY3RvciA9IDEuMzM7XG4gIGltZ193aWR0aCA9IDI5OTtcbiAgaW1nX2hlaWdodCA9IDIxOTtcblxuICAgIGRvdHMgPSBjb250YWluZXIuYXBwZW5kKCdkaXYnKVxuICAgIC5hdHRyKCdjbGFzcycsICdhYnMnKVxuICAgICAgLnN0eWxlKCd3aWR0aCcsIHRoaXMuX3dpZHRoKHByb3BzKSArIFwicHhcIilcbiAgICAgIC5zdHlsZSgnaGVpZ2h0JywgdGhpcy5faGVpZ2h0KHByb3BzKSArIFwicHhcIilcbiAgICAgIC5zdHlsZSgnbGVmdCcsIHRoaXMuX21hcmdpbi5sZWZ0ICsgXCJweFwiKVxuICAgICAgLy8gLnN0eWxlKCd0b3AnLCB0aGlzLl9tYXJnaW4udG9wICsgaW1nX2hlaWdodF9vZmZzZXQgKyBcInB4XCIpXG4gICAgICAuc3R5bGUoJ3RvcCcsICBpbWdfaGVpZ2h0X29mZnNldCArIFwicHhcIilcbiAgICAuYXBwZW5kKCdzdmcnKVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIHRoaXMuX2hlaWdodChwcm9wcykgKyBcInB4XCIpXG4gICAgICAuYXR0cignY2xhc3MnLCAnYWJzJyk7XG5cbiAgICAgZG90cy5hcHBlbmQoJ3RleHQnKVxuICAgICAgLmF0dHIoJ3gnLCAwKVxuICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgLmF0dHIoJ2R5JywgJy43MGVtJylcbiAgICAgIC5hdHRyKCdkeCcsICctLjJlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzI0cHgnKVxuICAgICAgLnRleHQoJy4uLicpO1xuXG4gICAgIGRvdHMuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCd4JywgMClcbiAgICAgIC5hdHRyKCd5JywgdGhpcy5faGVpZ2h0KHByb3BzKSAtIDMzKVxuICAgICAgLmF0dHIoJ2R5JywgJy44MWVtJylcbiAgICAgIC5hdHRyKCdkeCcsICctLjJlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzI0cHgnKVxuICAgICAgLnRleHQoJy4uLicpO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgMzsgaSsrICkge1xuICAgIHZhciBpbWdfaGVpZ2h0X29mZnNldCA9IDA7XG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCBpOyBrKysgKSB7XG4gICAgICBpbWdfaGVpZ2h0X29mZnNldCArPSBpbWdfaGVpZ2h0L01hdGgucG93KGZhY3Rvciwgayk7XG4gICAgfVxuXG5cbiAgICBjb250YWluZXIuYXBwZW5kKCdkaXYnKVxuICAgIC5hdHRyKCdjbGFzcycsICdhYnMnKVxuICAgICAgLnN0eWxlKCd3aWR0aCcsIHRoaXMuX3dpZHRoKHByb3BzKSArIFwicHhcIilcbiAgICAgIC5zdHlsZSgnaGVpZ2h0JywgdGhpcy5faGVpZ2h0KHByb3BzKSArIFwicHhcIilcbiAgICAuc3R5bGUoJ2xlZnQnLCB0aGlzLl9tYXJnaW4ubGVmdCArIFwicHhcIilcbiAgICAuc3R5bGUoJ3RvcCcsIHRoaXMuX21hcmdpbi50b3AgKyBpbWdfaGVpZ2h0X29mZnNldCArIFwicHhcIilcbiAgICAgIC5hcHBlbmQoJ2ltZycpXG4gICAgICAuYXR0cignc3JjJywgXCJsZW5uYS5wbmdcIilcbiAgICAgIC5zdHlsZSgnd2lkdGgnLCBpbWdfd2lkdGgvTWF0aC5wb3coZmFjdG9yLGkpICsgXCJweFwiKVxuICAgICAgLnN0eWxlKCdoZWlnaHQnLCBpbWdfaGVpZ2h0L01hdGgucG93KGZhY3RvcixpKSArIFwicHhcIilcbiAgICAgIC5hdHRyKCdjbGFzcycsICdhYnMnKTtcbiAgfVxuXG4gY29udGFpbmVyLmFwcGVuZCgnc3ZnJylcbiAgICAuYXR0cignY2xhc3MnLCAnYWJzJylcbiAgICAuYXR0cignd2lkdGgnLCBwcm9wcy53aWR0aClcbiAgICAuYXR0cignaGVpZ2h0JywgcHJvcHMuaGVpZ2h0KVxuICAgIC5hcHBlbmQoJ2cnKVxuICAgIC5hdHRyKCdjbGFzcycsICdjaGFydCcpXG4gICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHRoaXMuX21hcmdpbi5sZWZ0ICsgJywnICsgdGhpcy5fbWFyZ2luLnRvcCArICcpJyk7XG5cbnNlYXJjaF9jb250YWluZXIgPSAgY29udGFpbmVyLmFwcGVuZCgnZGl2JylcbiAgLmF0dHIoJ2NsYXNzJywgJ2FicycpXG4gICAgLnN0eWxlKCd3aWR0aCcsIHByb3BzLnNlYXJjaC53ICsgXCJweFwiKVxuICAgIC5zdHlsZSgnaGVpZ2h0JywgcHJvcHMuc2VhcmNoLmggKyBcInB4XCIpXG4gIC5zdHlsZSgnbGVmdCcsIHRoaXMuX21hcmdpbi5sZWZ0ICsgcHJvcHMuc2VhcmNoLnggKyBcInB4XCIpXG4gIC5zdHlsZSgndG9wJywgdGhpcy5fbWFyZ2luLnRvcCArIHByb3BzLnNlYXJjaC55ICsgXCJweFwiKTtcblxuc2VhcmNoX2NvbnRhaW5lci5hcHBlbmQoJ2NhbnZhcycpXG4gICAgLnN0eWxlKCd3aWR0aCcsIHByb3BzLnNlYXJjaC53ICsgXCJweFwiKVxuICAgIC5zdHlsZSgnaGVpZ2h0JywgcHJvcHMuc2VhcmNoLmggKyBcInB4XCIpXG4gICAgLmF0dHIoJ2NsYXNzJywgJ2hlYXRtYXAgYWJzJylcbiAgICAuY2xhc3NlZCgncGl4ZWxhdGVkJywgcHJvcHMucGl4ZWxhdGVkKTtcblxuc2VhcmNoX2NvbnRhaW5lci5hcHBlbmQoJ3N2ZycpXG4gICAgLnN0eWxlKCd3aWR0aCcsIHByb3BzLnNlYXJjaC53ICsgXCJweFwiKVxuICAgIC5zdHlsZSgnaGVpZ2h0JywgcHJvcHMuc2VhcmNoLmggKyBcInB4XCIpXG4gICAgLmF0dHIoJ2NsYXNzJywgJ3NlYXJjaCBhYnMnKVxuICAgIC5jbGFzc2VkKCdwaXhlbGF0ZWQnLCBwcm9wcy5waXhlbGF0ZWQpO1xuXG5mZWF0dXJlX3lfb2Zmc2V0ID0gMTQwO1xuXG5zdGFnZV9jb250YWluZXIgPSAgY29udGFpbmVyLmFwcGVuZCgnZGl2JylcbiAgLmF0dHIoJ2NsYXNzJywgJ2FicycpXG4gICAgLnN0eWxlKCd3aWR0aCcsIHByb3BzLmZlYXR1cmUudyArIFwicHhcIilcbiAgICAuc3R5bGUoJ2hlaWdodCcsIHByb3BzLmZlYXR1cmUuaCArIFwicHhcIilcbiAgLnN0eWxlKCdsZWZ0JywgdGhpcy5fbWFyZ2luLmxlZnQgKyBwcm9wcy5mZWF0dXJlLnggKyBcInB4XCIpXG4gIC5zdHlsZSgndG9wJywgdGhpcy5fbWFyZ2luLnRvcCArIHByb3BzLmZlYXR1cmUueSAgKyBcInB4XCIpO1xuXG5zdGFnZV9jb250YWluZXIuYXBwZW5kKCdzdmcnKVxuICAgIC5zdHlsZSgnd2lkdGgnLCBwcm9wcy5mZWF0dXJlLncgKyBcInB4XCIpXG4gICAgLnN0eWxlKCdoZWlnaHQnLCBwcm9wcy5mZWF0dXJlLmggKyBcInB4XCIpXG4gICAgLmF0dHIoJ2NsYXNzJywgJ3N0YWdlIGFicycpXG4gICAgLmNsYXNzZWQoJ3BpeGVsYXRlZCcsIHByb3BzLnBpeGVsYXRlZCk7XG5cbmZlYXR1cmVfY29udGFpbmVyID0gIGNvbnRhaW5lci5hcHBlbmQoJ2RpdicpXG4gIC5hdHRyKCdjbGFzcycsICdhYnMnKVxuICAgIC5zdHlsZSgnd2lkdGgnLCBwcm9wcy5mZWF0dXJlLncgKyBcInB4XCIpXG4gICAgLnN0eWxlKCdoZWlnaHQnLCBwcm9wcy5mZWF0dXJlLmggKyBcInB4XCIpXG4gIC5zdHlsZSgnbGVmdCcsIHRoaXMuX21hcmdpbi5sZWZ0ICsgcHJvcHMuZmVhdHVyZS54ICsgXCJweFwiKVxuICAuc3R5bGUoJ3RvcCcsIHRoaXMuX21hcmdpbi50b3AgKyBwcm9wcy5mZWF0dXJlLnkgICsgZmVhdHVyZV95X29mZnNldCArIFwicHhcIik7XG5cbmZlYXR1cmVfY29udGFpbmVyLmFwcGVuZCgnc3ZnJylcbiAgICAuc3R5bGUoJ3dpZHRoJywgcHJvcHMuZmVhdHVyZS53ICsgXCJweFwiKVxuICAgIC5zdHlsZSgnaGVpZ2h0JywgcHJvcHMuZmVhdHVyZS5oICsgXCJweFwiKVxuICAgIC5hdHRyKCdjbGFzcycsICdmZWF0dXJlIGFicycpXG4gICAgLmNsYXNzZWQoJ3BpeGVsYXRlZCcsIHByb3BzLnBpeGVsYXRlZCk7XG5cbiAgdGhpcy51cGRhdGUoZWwsIHByb3BzLCBzdGF0ZSk7XG59XG5cbm5zLl9heGlzID0gZnVuY3Rpb24oc2NhbGVzKSB7XG4gIHZhciB4ID0gZDMuc3ZnLmF4aXMoKVxuICAgICAgICAgICAgICAuc2NhbGUoc2NhbGVzLngpXG4gICAgICAgICAgICAgIC50aWNrVmFsdWVzKFsxLDIsMyw0LDUsNl0pXG4gICAgICAgICAgICAgIC5vcmllbnQoJ2JvdHRvbScpO1xuXG4gIHZhciB5ID0gZDMuc3ZnLmF4aXMoKVxuICAgICAgICAgICAgICAuc2NhbGUoc2NhbGVzLnkpXG4gICAgICAgICAgICAgIC50aWNrVmFsdWVzKFsxLDIsMyw0LDUsNl0pXG4gICAgICAgICAgICAgIC5vcmllbnQoJ2xlZnQnKTtcblxuICByZXR1cm4ge3g6IHgsIHk6IHl9O1xufVxuXG5ucy5fc2NhbGVzID0gZnVuY3Rpb24ocHJvcHMpIHtcbiAgd2lkdGggPSB0aGlzLl93aWR0aChwcm9wcykvMztcbiAgaGVpZ2h0ID0gdGhpcy5faGVpZ2h0KHByb3BzKTtcblxuICB2YXIgeSA9IGQzLnNjYWxlLmxpbmVhcigpXG4gICAgICAgICAgLnJhbmdlKFtoZWlnaHQsIDBdKTtcbiAgdmFyIHggPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAgIC5yYW5nZShbMCwgd2lkdGhdKTtcblxuICByZXR1cm4ge3g6IHgsIHk6IHl9O1xufVxuXG5ucy51cGRhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMsIHN0YXRlKSB7XG4gIHZhciBtYXJnaW4gPSB0aGlzLl9tYXJnaW47XG4gIHZhciB3aWR0aCA9IHRoaXMuX3dpZHRoKHByb3BzKTtcbiAgdmFyIGhlaWdodCA9IHRoaXMuX2hlaWdodChwcm9wcyk7XG4gIHZhciBzY2FsZXMgPSB0aGlzLl9zY2FsZXMocHJvcHMpO1xuICB2YXIgYXhpcyA9IHRoaXMuX2F4aXMoc2NhbGVzKTtcblxuICB2YXIgZGF0YSA9IG51bGxcbiAgaWYgKHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5sZW5ndGggPiAwICYmIEFycmF5LmlzQXJyYXkoc3RhdGUuZGF0YVswXSkpIHtcbiAgICBkYXRhID0gc3RhdGUuZGF0YTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKHZhciBpIGluIHN0YXRlLmRhdGEpIHtcbiAgICAgIGlmIChzdGF0ZS5kYXRhW2ldLnNjYWxlID09IHByb3BzLnNjYWxlKSB7XG4gICAgICAgIGRhdGEgPSBzdGF0ZS5kYXRhW2ldLmRhdGE7XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBpZiAoZGF0YSkge1xuXG4gICAgaWYgKHByb3BzLnBlcmNlbnQpIHtcbiAgICAgIHZhciBzdW0gPSBkMy5zdW0oZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gZDMuc3VtKGQpOyB9KTtcbiAgICAgIGRhdGEgPSBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiBkLm1hcChmdW5jdGlvbihkKSB7cmV0dXJuIDEuMCAqIGQgLyBzdW07fSk7IH0pO1xuICAgICAgZGF0YSA9IGRhdGEucmV2ZXJzZSgpO1xuICAgIH1cblxuICAgIHZhciBkeCA9IGRhdGFbMF0ubGVuZ3RoO1xuICAgIHZhciBkeSA9IGRhdGEubGVuZ3RoO1xuXG4gICAgdmFyIHN0YXJ0ID0gMTtcbiAgICBzY2FsZXMueC5kb21haW4oW3N0YXJ0LCBkeCtzdGFydF0pO1xuICAgIHNjYWxlcy55LmRvbWFpbihbc3RhcnQsIGR5K3N0YXJ0XSk7XG5cbiAgICB2YXIgY29sb3JEb21haW4gPSBbMCwgZDMubWF4KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQzLm1heChkKTt9KV07XG4gICAgaWYgKHByb3BzLnBlcmNlbnQpIHtcbiAgICAgIGNvbG9yRG9tYWluID0gWzAsIDAuMDUsIDFdO1xuICAgICAgY29sb3JSYW5nZSA9IFsncmdiKDI1NSwyNTUsMjU1KScsJ3JnYigyNTUsMjU1LDIxNyknLCdyZ2IoMjM3LDI0OCwxNzcpJywncmdiKDE5OSwyMzMsMTgwKScsJ3JnYigxMjcsMjA1LDE4NyknLCdyZ2IoNjUsMTgyLDE5NiknLCdyZ2IoMjksMTQ1LDE5MiknLCdyZ2IoMzQsOTQsMTY4KScsJ3JnYigzNyw1MiwxNDgpJywncmdiKDgsMjksODgpJ107XG4gICAgICBjb2xvclJhbmdlID0gWydyZ2IoMjU1LDI1NSwyNTUpJywgJ3JnYigxMjcsMjA1LDE4NyknLCAncmdiKDgsMjksODgpJ107XG4gICAgfVxuICAgIHZhciBjb2xvcjtcbiAgICBpZiAocHJvcHMuZ3JleSkge1xuICAgICAgY29sb3IgPSBkMy5zY2FsZVxuICAgICAgICAgICAgICAgICAgLy8gLnBvdygpLmV4cG9uZW50KDIpXG4gICAgICAgICAgICAgICAgICAubGluZWFyKClcbiAgICAgICAgICAgICAgICAgIC8vIC5kb21haW4oY29sb3JEb21haW4pXG4gICAgICAgICAgICAgICAgICAvLyAucmFuZ2UoW1wiIzAwMDAwMFwiLFwiI2ZmZmZmZlwiXS5yZXZlcnNlKCkpO1xuICAgICAgICAgICAgICAgICAgLmRvbWFpbihbMSwgMjU1XSlcbiAgICAgICAgICAgICAgICAgIC5yYW5nZShbXCIjMDAwMDAwXCIsXCIjZmZmZmZmXCJdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29sb3IgPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAgICAgICAgICAgLmRvbWFpbihjb2xvckRvbWFpbilcbiAgICAgICAgICAgICAgICAgIC5yYW5nZShjb2xvclJhbmdlKTtcbiAgICB9XG5cbiAgICB2YXIgY2hhcnQgPSBkMy5zZWxlY3QoZWwpLnNlbGVjdCgnLmNoYXJ0Jyk7XG4gICAgLy8gY2hhcnQuYXBwZW5kKCd0ZXh0JykuYXR0cignY2xhc3MnLCAnYXhpcycpLnRleHQoZnVuY3Rpb24oKSB7IHZhciBhID0gW107IGZvcihpPTA7IGk8MjA7IGkrKykge2EucHVzaCgnMCwgJyk7fSByZXR1cm4gJ0xVVD0gWyAnICsgYS5qb2luKCcnKS5zbGljZSgwLC0yKSArJyBdJzt9KTtcblxuICAgIHZhciB3aW5kb3cgPSBjaGFydC5zZWxlY3RBbGwoJy53aW5kb3cnKVxuICAgICAgICAgLmRhdGEoW3N0YXRlLmxvY2F0aW9uXSk7XG4gICAgXG4gICAgd2luZG93X2VudGVyID0gd2luZG93LmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgIC5hdHRyKCdjbGFzcycsICd3aW5kb3cnKVxuXG4gICAgd2luZG93X2VudGVyLmFwcGVuZCgncmVjdCcpO1xuICAgIHdpbmRvd19lbnRlci5hcHBlbmQoJ2xpbmUnKVxuICAgICAgIC5hdHRyKCdjbGFzcycsICdsaW5lMCcpO1xuICAgIHdpbmRvd19lbnRlci5hcHBlbmQoJ2xpbmUnKVxuICAgICAgIC5hdHRyKCdjbGFzcycsICdsaW5lMScpO1xuICAgIHdpbmRvd19lbnRlci5hcHBlbmQoJ2xpbmUnKVxuICAgICAgIC5hdHRyKCdjbGFzcycsICdsaW5lMicpO1xuICAgIHdpbmRvd19lbnRlci5hcHBlbmQoJ2xpbmUnKVxuICAgICAgIC5hdHRyKCdjbGFzcycsICdsaW5lMycpO1xuICAgIHdpbmRvd19lbnRlci5hcHBlbmQoJ3BvbHlnb24nKVxuICAgICAgIC5hdHRyKCdjbGFzcycsICdwb2x5Z29uMCcpXG4gICAgd2luZG93X2VudGVyLmFwcGVuZCgncG9seWdvbicpXG4gICAgICAgLmF0dHIoJ2NsYXNzJywgJ3BvbHlnb24xJylcbiAgICB3aW5kb3dfZW50ZXIuYXBwZW5kKCdwb2x5Z29uJylcbiAgICAgICAuYXR0cignY2xhc3MnLCAncG9seWdvbjInKVxuICAgIHdpbmRvd19lbnRlci5hcHBlbmQoJ3BvbHlnb24nKVxuICAgICAgIC5hdHRyKCdjbGFzcycsICdwb2x5Z29uMycpO1xuXG4gICAgd2luZG93LnNlbGVjdCgncmVjdCcpXG4gICAgICAuYXR0cigneCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC54fSlcbiAgICAgIC5hdHRyKCd5JywgZnVuY3Rpb24oZCkge3JldHVybiBkLnl9KVxuICAgICAgLmF0dHIoJ3dpZHRoJywgZnVuY3Rpb24oZCkge3JldHVybiBkLnd9KVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC5ofSlcbiAgICAgIC5hdHRyKCdmaWxsJywgJ3doaXRlJylcbiAgICAgIC5hdHRyKCdmaWxsLW9wYWNpdHknLCAwLjUpXG4gICAgICAuc3R5bGUoJ3N0cm9rZScsICdibGFjaycpXG4gICAgICAuc3R5bGUoJ3N0cm9rZS13aWR0aCcsICcycHgnKVxuICAgICAgLnN0eWxlKCdzdHJva2Utb3BhY2l0eScsIDAuNSk7XG5cbiAgICB3aW5kb3cuc2VsZWN0KCcucG9seWdvbjAnKVxuICAgICAgLmF0dHIoJ3BvaW50cycsIGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgdmFyIHgwID0gZC54O1xuICAgICAgICB2YXIgeTAgPSBkLnkgKyBkLmg7XG4gICAgICAgIHZhciB4MSA9IHByb3BzLnNlYXJjaC54O1xuICAgICAgICB2YXIgeTEgPSBwcm9wcy5zZWFyY2gueSArIHByb3BzLnNlYXJjaC5oO1xuICAgICAgICB2YXIgeDIgPSBwcm9wcy5zZWFyY2gueCArIHByb3BzLnNlYXJjaC53O1xuICAgICAgICB2YXIgeTIgPSBwcm9wcy5zZWFyY2gueSArIHByb3BzLnNlYXJjaC5oO1xuICAgICAgICB2YXIgeDMgPSBkLnggKyBkLnc7XG4gICAgICAgIHZhciB5MyA9IGQueSArIGQuaDtcbiAgICAgICAgcmV0dXJuIHgwKycsJyt5MCsnICcrIHgxKycsJyt5MSsnICcrIHgyKycsJyt5MisnICcrIHgzKycsJyt5MztcbiAgICAgIH0pXG4gICAgICAuYXR0cignZmlsbCcsICdwdXJwbGUnKVxuICAgICAgLmF0dHIoJ2ZpbGwtb3BhY2l0eScsIDAuMilcbiAgICAgIC5zdHlsZSgnc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgIC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgJzJweCcpXG4gICAgICAuc3R5bGUoJ3N0cm9rZS1vcGFjaXR5JywgMC41KTtcblxuICAgIHdpbmRvdy5zZWxlY3QoJy5wb2x5Z29uMScpXG4gICAgICAuYXR0cigncG9pbnRzJywgZnVuY3Rpb24oZCkge1xuICAgICAgICB2YXIgeDAgPSBkLnggKyBkLnc7XG4gICAgICAgIHZhciB5MCA9IGQueSArIGQuaDtcbiAgICAgICAgdmFyIHgxID0gcHJvcHMuc2VhcmNoLnggKyBwcm9wcy5zZWFyY2gudztcbiAgICAgICAgdmFyIHkxID0gcHJvcHMuc2VhcmNoLnkgKyBwcm9wcy5zZWFyY2guaDtcbiAgICAgICAgdmFyIHgyID0gcHJvcHMuc2VhcmNoLnggKyBwcm9wcy5zZWFyY2gudztcbiAgICAgICAgdmFyIHkyID0gcHJvcHMuc2VhcmNoLnk7XG4gICAgICAgIHZhciB4MyA9IGQueCArIGQudztcbiAgICAgICAgdmFyIHkzID0gZC55O1xuICAgICAgICByZXR1cm4geDArJywnK3kwKycgJysgeDErJywnK3kxKycgJysgeDIrJywnK3kyKycgJysgeDMrJywnK3kzO1xuICAgICAgfSlcbiAgICAgIC5hdHRyKCdmaWxsJywgJ3B1cnBsZScpXG4gICAgICAuYXR0cignZmlsbC1vcGFjaXR5JywgMC4yKVxuICAgICAgLnN0eWxlKCdzdHJva2UnLCAnYmxhY2snKVxuICAgICAgLnN0eWxlKCdzdHJva2Utd2lkdGgnLCAnMnB4JylcbiAgICAgIC5zdHlsZSgnc3Ryb2tlLW9wYWNpdHknLCAwLjUpO1xuXG4gICAgd2luZG93LnNlbGVjdCgnLnBvbHlnb24yJylcbiAgICAgIC5hdHRyKCdwb2ludHMnLCBmdW5jdGlvbihkKSB7XG4gICAgICAgIHZhciB4MCA9IGQueCArIGQudztcbiAgICAgICAgdmFyIHkwID0gZC55O1xuICAgICAgICB2YXIgeDEgPSBwcm9wcy5zZWFyY2gueCArIHByb3BzLnNlYXJjaC53O1xuICAgICAgICB2YXIgeTEgPSBwcm9wcy5zZWFyY2gueTtcbiAgICAgICAgdmFyIHgyID0gcHJvcHMuc2VhcmNoLng7XG4gICAgICAgIHZhciB5MiA9IHByb3BzLnNlYXJjaC55O1xuICAgICAgICB2YXIgeDMgPSBkLng7XG4gICAgICAgIHZhciB5MyA9IGQueTtcbiAgICAgICAgcmV0dXJuIHgwKycsJyt5MCsnICcrIHgxKycsJyt5MSsnICcrIHgyKycsJyt5MisnICcrIHgzKycsJyt5MztcbiAgICAgIH0pXG4gICAgICAuYXR0cignZmlsbCcsICdwdXJwbGUnKVxuICAgICAgLmF0dHIoJ2ZpbGwtb3BhY2l0eScsIDAuMilcbiAgICAgIC5zdHlsZSgnc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgIC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgJzJweCcpXG4gICAgICAuc3R5bGUoJ3N0cm9rZS1vcGFjaXR5JywgMC41KTtcblxuICAgIHdpbmRvdy5zZWxlY3QoJy5wb2x5Z29uMycpXG4gICAgICAuYXR0cigncG9pbnRzJywgZnVuY3Rpb24oZCkge1xuICAgICAgICB2YXIgeDAgPSBkLng7XG4gICAgICAgIHZhciB5MCA9IGQueTtcbiAgICAgICAgdmFyIHgxID0gcHJvcHMuc2VhcmNoLng7XG4gICAgICAgIHZhciB5MSA9IHByb3BzLnNlYXJjaC55O1xuICAgICAgICB2YXIgeDIgPSBwcm9wcy5zZWFyY2gueDtcbiAgICAgICAgdmFyIHkyID0gcHJvcHMuc2VhcmNoLnkgKyBwcm9wcy5zZWFyY2guaDtcbiAgICAgICAgdmFyIHgzID0gZC54O1xuICAgICAgICB2YXIgeTMgPSBkLnkgKyBkLmg7XG4gICAgICAgIHJldHVybiB4MCsnLCcreTArJyAnKyB4MSsnLCcreTErJyAnKyB4MisnLCcreTIrJyAnKyB4MysnLCcreTM7XG4gICAgICB9KVxuICAgICAgLmF0dHIoJ2ZpbGwnLCAncHVycGxlJylcbiAgICAgIC5hdHRyKCdmaWxsLW9wYWNpdHknLCAwLjIpXG4gICAgICAuc3R5bGUoJ3N0cm9rZScsICdibGFjaycpXG4gICAgICAuc3R5bGUoJ3N0cm9rZS13aWR0aCcsICcycHgnKVxuICAgICAgLnN0eWxlKCdzdHJva2Utb3BhY2l0eScsIDAuNSk7XG5cbiAgICAvLyB3aW5kb3cuc2VsZWN0KCcubGluZTAnKVxuICAgIC8vICAgLmF0dHIoJ3gxJywgZnVuY3Rpb24oZCkge3JldHVybiBkLnh9KVxuICAgIC8vICAgLmF0dHIoJ3kxJywgZnVuY3Rpb24oZCkge3JldHVybiBkLnl9KVxuICAgIC8vICAgLmF0dHIoJ3gyJywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5zZWFyY2gueCArIFwicHhcIn0pXG4gICAgLy8gICAuYXR0cigneTInLCBmdW5jdGlvbihkKSB7cmV0dXJuIHByb3BzLnNlYXJjaC55ICsgXCJweFwifSlcbiAgICAvLyAgIC5zdHlsZSgnc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAvLyAgIC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgJzJweCcpXG4gICAgLy8gICAuc3R5bGUoJ3N0cm9rZS1vcGFjaXR5JywgMC41KTtcblxuICAgIC8vIHdpbmRvdy5zZWxlY3QoJy5saW5lMScpXG4gICAgLy8gICAuYXR0cigneDEnLCBmdW5jdGlvbihkKSB7cmV0dXJuIGQueCtkLnd9KVxuICAgIC8vICAgLmF0dHIoJ3kxJywgZnVuY3Rpb24oZCkge3JldHVybiBkLnl9KVxuICAgIC8vICAgLmF0dHIoJ3gyJywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5zZWFyY2gueCArIHByb3BzLnNlYXJjaC53ICsgXCJweFwifSlcbiAgICAvLyAgIC5hdHRyKCd5MicsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuc2VhcmNoLnkgKyBcInB4XCJ9KVxuICAgIC8vICAgLnN0eWxlKCdzdHJva2UnLCAnYmxhY2snKVxuICAgIC8vICAgLnN0eWxlKCdzdHJva2Utd2lkdGgnLCAnMnB4JylcbiAgICAvLyAgIC5zdHlsZSgnc3Ryb2tlLW9wYWNpdHknLCAwLjUpO1xuXG4gICAgLy8gd2luZG93LnNlbGVjdCgnLmxpbmUyJylcbiAgICAvLyAgIC5hdHRyKCd4MScsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC54K2Qud30pXG4gICAgLy8gICAuYXR0cigneTEnLCBmdW5jdGlvbihkKSB7cmV0dXJuIGQueStkLmh9KVxuICAgIC8vICAgLmF0dHIoJ3gyJywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5zZWFyY2gueCArIHByb3BzLnNlYXJjaC53ICsgXCJweFwifSlcbiAgICAvLyAgIC5hdHRyKCd5MicsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuc2VhcmNoLnkgKyBwcm9wcy5zZWFyY2guaCArIFwicHhcIn0pXG4gICAgLy8gICAuc3R5bGUoJ3N0cm9rZScsICdibGFjaycpXG4gICAgLy8gICAuc3R5bGUoJ3N0cm9rZS13aWR0aCcsICcycHgnKVxuICAgIC8vICAgLnN0eWxlKCdzdHJva2Utb3BhY2l0eScsIDAuNSk7XG5cbiAgICAvLyB3aW5kb3cuc2VsZWN0KCcubGluZTMnKVxuICAgIC8vICAgLmF0dHIoJ3gxJywgZnVuY3Rpb24oZCkge3JldHVybiBkLnh9KVxuICAgIC8vICAgLmF0dHIoJ3kxJywgZnVuY3Rpb24oZCkge3JldHVybiBkLnkrZC5ofSlcbiAgICAvLyAgIC5hdHRyKCd4MicsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuc2VhcmNoLnggKyBcInB4XCJ9KVxuICAgIC8vICAgLmF0dHIoJ3kyJywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5zZWFyY2gueSArIHByb3BzLnNlYXJjaC5oICsgXCJweFwifSlcbiAgICAvLyAgIC5zdHlsZSgnc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAvLyAgIC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgJzJweCcpXG4gICAgLy8gICAuc3R5bGUoJ3N0cm9rZS1vcGFjaXR5JywgMC41KTtcblxuICAgIHdpbmRvdy5leGl0KCkucmVtb3ZlKCk7XG5cbiAgICB2YXIgaGVhdG1hcCA9IGQzLnNlbGVjdChlbCkuc2VsZWN0QWxsKCcuaGVhdG1hcCcpXG4gICAgICAgIC5lYWNoKGZ1bmN0aW9uKGQpIHtcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcylcbiAgICAgICAgICAuYXR0cignd2lkdGgnLCBkeClcbiAgICAgICAgICAuYXR0cignaGVpZ2h0JywgZHkpXG4gICAgICAgICAgLy8gLmNhbGwoZnVuY3Rpb24oKSB7IGRyYXdJbWFnZVJvd0Jsb2NrKHRoaXMsIGRhdGEsIHByb3BzLnlibG9jaywgcHJvcHMueGJsb2NrKTt9KTtcbiAgICAgICAgICAuY2FsbChmdW5jdGlvbigpIHsgZHJhd1NlYXJjaFdpbmRvdyh0aGlzLCBpbWdfd2lkdGgsIGltZ193aWR0aCwgZmFjdG9yLCAwLCBzdGF0ZS5sb2NhdGlvbik7fSk7XG4gICAgICAgIH0pO1xuXG4gICAgdmFyIHNlYXJjaG1hcCA9IGQzLnNlbGVjdChlbCkuc2VsZWN0QWxsKCcuc2VhcmNoJyk7XG5cbiAgICBzZWFyY2htYXAuYXBwZW5kKCdyZWN0JylcbiAgICAgICAgLmF0dHIoJ3gnLCBmdW5jdGlvbihkKSB7cmV0dXJuIDB9KVxuICAgICAgICAuYXR0cigneScsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gMH0pXG4gICAgICAgIC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuc2VhcmNoLnd9KVxuICAgICAgICAuYXR0cignaGVpZ2h0JywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5zZWFyY2guaH0pXG4gICAgICAgIC5zdHlsZSgnc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgICAgLnN0eWxlKCdzdHJva2Utd2lkdGgnLCAnOHB4JylcbiAgICAgICAgLnN0eWxlKCdmaWxsLW9wYWNpdHknLCAwLjApXG4gICAgICAgIC5zdHlsZSgnc3Ryb2tlLW9wYWNpdHknLCAxLjApO1xuXG4gICAgdmFyIGNlbGxfd2lkdGggPSAyO1xuICAgIHZhciBjZWxsX2hlaWdodCA9IDI7XG4gICAgdmFyIHhfb2Zmc2V0ID0gNjtcbiAgICB2YXIgeV9vZmZzZXQgPSA0O1xuXG4gICAgLy8gc2VhcmNobWFwXG4gICAgc2VhcmNobWFwLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigneCcsIHByb3BzLnNlYXJjaC53LzIwICogKHhfb2Zmc2V0IC0gMikpXG4gICAgICAuYXR0cigneScsIHByb3BzLnNlYXJjaC5oLzIwICogKHlfb2Zmc2V0IC0gMS42KSlcbiAgICAgIC5hdHRyKCdkeScsICcuODFlbScpXG4gICAgICAuYXR0cignZHgnLCAnLjFlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzE2cHgnKVxuICAgICAgLnRleHQoJyh4LHkpJyk7XG5cbiAgICBzZWFyY2htYXAuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCd4JywgcHJvcHMuc2VhcmNoLncvMjAgKiAoeF9vZmZzZXQgKyBjZWxsX3dpZHRoKjMpKVxuICAgICAgLmF0dHIoJ3knLCBwcm9wcy5zZWFyY2guaC8yMCAqICh5X29mZnNldCArIGNlbGxfaGVpZ2h0KSlcbiAgICAgIC5hdHRyKCdkeScsICcuOTFlbScpXG4gICAgICAuYXR0cignZHgnLCAnLjNlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzE2cHgnKVxuICAgICAgLnRleHQoJzNoJyk7XG5cbiAgICBzZWFyY2htYXAuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCd4JywgcHJvcHMuc2VhcmNoLncvMjAgKiAoeF9vZmZzZXQgKyBjZWxsX3dpZHRoKjEpKVxuICAgICAgLmF0dHIoJ3knLCBwcm9wcy5zZWFyY2guaC8yMCAqICh5X29mZnNldCArIGNlbGxfaGVpZ2h0KjMpKVxuICAgICAgLmF0dHIoJ2R5JywgJy45OGVtJylcbiAgICAgIC5hdHRyKCdkeCcsICcuMmVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuICAgICAgLnN0eWxlKCdmb250LXNpemUnLCAnMTZweCcpXG4gICAgICAudGV4dCgnM3cnKTtcblxuICAgIHNlYXJjaG1hcC5hcHBlbmQoJ2xpbmUnKVxuICAgICAgLmF0dHIoe1xuICAgICAgICAgICBcIngxXCIgOiBwcm9wcy5zZWFyY2gudy8yMCAqICh4X29mZnNldCArIGNlbGxfd2lkdGgqMiksXG4gICAgICAgICAgIFwieDJcIiA6IHByb3BzLnNlYXJjaC53LzIwICogKHhfb2Zmc2V0ICsgY2VsbF93aWR0aCozKSxcbiAgICAgICAgICAgXCJ5MVwiIDogcHJvcHMuc2VhcmNoLncvMjAgKiAoeV9vZmZzZXQgKyBjZWxsX2hlaWdodCozKSArIDEwLFxuICAgICAgICAgICBcInkyXCIgOiBwcm9wcy5zZWFyY2gudy8yMCAqICh5X29mZnNldCArIGNlbGxfaGVpZ2h0KjMpICsgMTAsXG4gICAgICAgICAgIFwiZmlsbFwiIDogXCJub25lXCIsXG4gICAgICAgICAgIFwic2hhcGUtcmVuZGVyaW5nXCIgOiBcImNyaXNwRWRnZXNcIixcbiAgICAgICAgICAgXCJzdHJva2VcIiA6IFwiYmxhY2tcIixcbiAgICAgICAgICAgXCJzdHJva2Utd2lkdGhcIiA6IFwiMnB4XCJcbiAgICAgICB9KTtcbiAgICBzZWFyY2htYXAuYXBwZW5kKCdsaW5lJylcbiAgICAgIC5hdHRyKHtcbiAgICAgICAgICAgXCJ4MVwiIDogcHJvcHMuc2VhcmNoLncvMjAgKiAoeF9vZmZzZXQgKyBjZWxsX3dpZHRoKjApLFxuICAgICAgICAgICBcIngyXCIgOiBwcm9wcy5zZWFyY2gudy8yMCAqICh4X29mZnNldCArIGNlbGxfd2lkdGgqMSksXG4gICAgICAgICAgIFwieTFcIiA6IHByb3BzLnNlYXJjaC53LzIwICogKHlfb2Zmc2V0ICsgY2VsbF9oZWlnaHQqMykgKyAxMCxcbiAgICAgICAgICAgXCJ5MlwiIDogcHJvcHMuc2VhcmNoLncvMjAgKiAoeV9vZmZzZXQgKyBjZWxsX2hlaWdodCozKSArIDEwLFxuICAgICAgICAgICBcImZpbGxcIiA6IFwibm9uZVwiLFxuICAgICAgICAgICBcInNoYXBlLXJlbmRlcmluZ1wiIDogXCJjcmlzcEVkZ2VzXCIsXG4gICAgICAgICAgIFwic3Ryb2tlXCIgOiBcImJsYWNrXCIsXG4gICAgICAgICAgIFwic3Ryb2tlLXdpZHRoXCIgOiBcIjJweFwiXG4gICAgICAgfSk7XG4gICAgc2VhcmNobWFwLmFwcGVuZCgnbGluZScpXG4gICAgICAuYXR0cih7XG4gICAgICAgICAgIFwieDFcIiA6IHByb3BzLnNlYXJjaC53LzIwICogKHhfb2Zmc2V0ICsgY2VsbF93aWR0aCozKSArIDEwLFxuICAgICAgICAgICBcIngyXCIgOiBwcm9wcy5zZWFyY2gudy8yMCAqICh4X29mZnNldCArIGNlbGxfd2lkdGgqMykgKyAxMCxcbiAgICAgICAgICAgXCJ5MVwiIDogcHJvcHMuc2VhcmNoLncvMjAgKiAoeV9vZmZzZXQgKyBjZWxsX2hlaWdodCowKSxcbiAgICAgICAgICAgXCJ5MlwiIDogcHJvcHMuc2VhcmNoLncvMjAgKiAoeV9vZmZzZXQgKyBjZWxsX2hlaWdodCoxKSxcbiAgICAgICAgICAgXCJmaWxsXCIgOiBcIm5vbmVcIixcbiAgICAgICAgICAgXCJzaGFwZS1yZW5kZXJpbmdcIiA6IFwiY3Jpc3BFZGdlc1wiLFxuICAgICAgICAgICBcInN0cm9rZVwiIDogXCJibGFja1wiLFxuICAgICAgICAgICBcInN0cm9rZS13aWR0aFwiIDogXCIycHhcIlxuICAgICAgIH0pO1xuICAgIHNlYXJjaG1hcC5hcHBlbmQoJ2xpbmUnKVxuICAgICAgLmF0dHIoe1xuICAgICAgICAgICBcIngxXCIgOiBwcm9wcy5zZWFyY2gudy8yMCAqICh4X29mZnNldCArIGNlbGxfd2lkdGgqMykgKyAxMCxcbiAgICAgICAgICAgXCJ4MlwiIDogcHJvcHMuc2VhcmNoLncvMjAgKiAoeF9vZmZzZXQgKyBjZWxsX3dpZHRoKjMpICsgMTAsXG4gICAgICAgICAgIFwieTFcIiA6IHByb3BzLnNlYXJjaC53LzIwICogKHlfb2Zmc2V0ICsgY2VsbF9oZWlnaHQqMiksXG4gICAgICAgICAgIFwieTJcIiA6IHByb3BzLnNlYXJjaC53LzIwICogKHlfb2Zmc2V0ICsgY2VsbF9oZWlnaHQqMyksXG4gICAgICAgICAgIFwiZmlsbFwiIDogXCJub25lXCIsXG4gICAgICAgICAgIFwic2hhcGUtcmVuZGVyaW5nXCIgOiBcImNyaXNwRWRnZXNcIixcbiAgICAgICAgICAgXCJzdHJva2VcIiA6IFwiYmxhY2tcIixcbiAgICAgICAgICAgXCJzdHJva2Utd2lkdGhcIiA6IFwiMnB4XCJcbiAgICAgICB9KTtcblxuICAgIGxiID0gc2VhcmNobWFwLnNlbGVjdEFsbCgnLmxicCcpLmRhdGEoWzAsMCwwLDAsMCwwLDAsMCwwXSlcbiAgICBsYi5lbnRlcigpLmFwcGVuZCgncmVjdCcpXG4gICAgICAuYXR0cignY2xhc3MnLCAnbGJwJylcbiAgICAgIC5hdHRyKCd4JywgZnVuY3Rpb24oZCwgaSkge3JldHVybiBwcm9wcy5zZWFyY2gudy8yMCAqIChjZWxsX3dpZHRoKigoaSUzKSkgKyB4X29mZnNldCl9KVxuICAgICAgLmF0dHIoJ3knLCBmdW5jdGlvbihkLCBpKSB7cmV0dXJuIHByb3BzLnNlYXJjaC5oLzIwICogKGNlbGxfaGVpZ2h0KihNYXRoLmZsb29yKGkvMykpICsgeV9vZmZzZXQpfSlcbiAgICAgIC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuc2VhcmNoLncvMjAgKiBjZWxsX3dpZHRofSlcbiAgICAgIC5hdHRyKCdoZWlnaHQnLCBmdW5jdGlvbihkKSB7cmV0dXJuIHByb3BzLnNlYXJjaC5oLzIwICogY2VsbF9oZWlnaHR9KVxuICAgICAgLnN0eWxlKCdmaWxsJywgJ3doaXRlJylcbiAgICAgIC5zdHlsZSgnZmlsbC1vcGFjaXR5JywgMC41KVxuICAgICAgLnN0eWxlKCdzdHJva2UnLCAnYmxhY2snKVxuICAgICAgLnN0eWxlKCdzdHJva2Utd2lkdGgnLCAnMnB4JylcbiAgICAgIC5zdHlsZSgnc3Ryb2tlLW9wYWNpdHknLCAxLjApO1xuXG4gICAgbGIuZXhpdCgpLnJlbW92ZSgpO1xuICAgIC8vIGZvciAodmFyIGogPSAwOyBqIDwgMzsgaisrKSB7XG4gICAgLy8gICBmb3IgKHZhciBpID0gMDsgaSA8IDM7IGkrKykge1xuICAgIC8vICAgICBzZWFyY2htYXAuYXBwZW5kKCdyZWN0JylcbiAgICAvLyAgICAgICAgIC5hdHRyKCd4JywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5zZWFyY2gudy8yMCAqIChjZWxsX3dpZHRoKmkgKyB4X29mZnNldCl9KVxuICAgIC8vICAgICAgICAgLmF0dHIoJ3knLCBmdW5jdGlvbihkKSB7cmV0dXJuIHByb3BzLnNlYXJjaC53LzIwICogKGNlbGxfaGVpZ2h0KmogKyB5X29mZnNldCl9KVxuICAgIC8vICAgICAgICAgLmF0dHIoJ3dpZHRoJywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5zZWFyY2gudy8yMCAqIGNlbGxfd2lkdGh9KVxuICAgIC8vICAgICAgICAgLmF0dHIoJ2hlaWdodCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuc2VhcmNoLmgvMjAgKiBjZWxsX2hlaWdodH0pXG4gICAgLy8gICAgICAgICAuc3R5bGUoJ2ZpbGwnLCAnd2hpdGUnKVxuICAgIC8vICAgICAgICAgLnN0eWxlKCdmaWxsLW9wYWNpdHknLCAwLjUpXG4gICAgLy8gICAgICAgICAuc3R5bGUoJ3N0cm9rZScsICdibGFjaycpXG4gICAgLy8gICAgICAgICAuc3R5bGUoJ3N0cm9rZS13aWR0aCcsICcycHgnKVxuICAgIC8vICAgICAgICAgLnN0eWxlKCdzdHJva2Utb3BhY2l0eScsIDEuMCk7XG4gICAgLy8gICB9XG4gICAgLy8gfVxuICAgIHhfZWRnZSA9IDYwO1xuICAgIHhfbmV4dCA9IHhfZWRnZSArIDIwO1xuICAgIHlfc3RhcnQgPSAzMjA7XG4gICAgeV9saW5lID0gMjQ7XG5cbiAgICB2YXIgc3RhZ2UgPSBkMy5zZWxlY3QoZWwpLnNlbGVjdEFsbCgnLnN0YWdlJyk7XG5cbiAgICBzdGFnZS5hcHBlbmQoJ3RleHQnKVxuICAgICAgLmF0dHIoJ3gnLCAwKVxuICAgICAgLmF0dHIoJ3knLCAwKVxuICAgICAgLmF0dHIoJ2R5JywgJy44MWVtJylcbiAgICAgIC5hdHRyKCdkeCcsICcuMWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuICAgICAgLnN0eWxlKCdmb250LXNpemUnLCAnMjRweCcpXG4gICAgICAudGV4dCgnc3RhZ2U6IDIvNTAsIGZlYXR1cmU6IDUvMTAnKTtcblxuICAgIC8vIHN0YWdlLmFwcGVuZCgndGV4dCcpXG4gICAgLy8gICAuYXR0cigneCcsIDApXG4gICAgLy8gICAuYXR0cigneScsIHlfbGluZSAqIDEuNClcbiAgICAvLyAgIC5hdHRyKCdkeScsICcuODFlbScpXG4gICAgLy8gICAuYXR0cignZHgnLCAnLjFlbScpXG4gICAgLy8gICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAvLyAgIC5zdHlsZSgnZm9udC1zaXplJywgJzI0cHgnKVxuICAgIC8vICAgLnRleHQoJ2ZlYXR1cmU6IDUvMTAnKTtcblxuICAgIHN0YWdlLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigneCcsIDApXG4gICAgICAuYXR0cigneScsIHlfbGluZSAqIDEuNCoxKVxuICAgICAgLmF0dHIoJ2R5JywgJy44MWVtJylcbiAgICAgIC5hdHRyKCdkeCcsICcuMWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuICAgICAgLnN0eWxlKCdmb250LXNpemUnLCAnMjRweCcpXG4gICAgICAudGV4dCgneDogMTAsIHk6IDEwLCB3OiAyLCBoOiAyJyk7XG5cbiAgICBzdGFnZS5hcHBlbmQoJ3RleHQnKVxuICAgICAgLmF0dHIoJ3gnLCAwKVxuICAgICAgLmF0dHIoJ3knLCB5X2xpbmUgKiAxLjQqMilcbiAgICAgIC5hdHRyKCdkeScsICcuODFlbScpXG4gICAgICAuYXR0cignZHgnLCAnLjFlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzI0cHgnKVxuICAgICAgLnRleHQoJ0xVVDogWzAsMCwxLDAsMSwxLDEsMCwuLi4nKTtcblxuXG4gICAgdmFyIGZlYXR1cmUgPSBkMy5zZWxlY3QoZWwpLnNlbGVjdEFsbCgnLmZlYXR1cmUnKTtcbiAgICAvLyBmZWF0dXJlLmFwcGVuZCgncmVjdCcpXG4gICAgLy8gICAgIC5hdHRyKCd4JywgZnVuY3Rpb24oZCkge3JldHVybiAwfSlcbiAgICAvLyAgICAgLmF0dHIoJ3knLCBmdW5jdGlvbihkKSB7cmV0dXJuIDB9KVxuICAgIC8vICAgICAuYXR0cignd2lkdGgnLCBmdW5jdGlvbihkKSB7cmV0dXJuIHByb3BzLmZlYXR1cmUud30pXG4gICAgLy8gICAgIC5hdHRyKCdoZWlnaHQnLCBmdW5jdGlvbihkKSB7cmV0dXJuIHByb3BzLmZlYXR1cmUuaH0pXG4gICAgLy8gICAgIC5zdHlsZSgnc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAvLyAgICAgLnN0eWxlKCdzdHJva2Utd2lkdGgnLCAnOHB4JylcbiAgICAvLyAgICAgLnN0eWxlKCdmaWxsLW9wYWNpdHknLCAwLjApXG4gICAgLy8gICAgIC5zdHlsZSgnc3Ryb2tlLW9wYWNpdHknLCAxLjApO1xuXG4gICAgdmFyIGxhYmVscyA9IFtcbiAgICAgICAge3g6IDAsIHk6IDAsICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWw6IDF9LFxuICAgICAgICB7eDogcHJvcHMuZmVhdHVyZS53LzIsIHk6IDAsICAgICAgICAgICAgICAgICBsYWJlbDogMn0sXG4gICAgICAgIHt4OiAwLCB5OiBwcm9wcy5mZWF0dXJlLmgvMiwgICAgICAgICAgICAgICAgIGxhYmVsOiAzfSxcbiAgICAgICAge3g6IHByb3BzLmZlYXR1cmUudy8yLCB5OiBwcm9wcy5mZWF0dXJlLmgvMiwgbGFiZWw6IDR9LFxuICAgIF07XG4gICAgdmFyIHJhZGl1cyA9IDIwO1xuICAgIHZhciBvZmZzZXQgPSAxMjtcblxuICAgIGZlYXR1cmVfZW50ZXIgPSBmZWF0dXJlLnNlbGVjdEFsbCgnLnN0ZXAnKS5kYXRhKGxhYmVscylcbiAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAuYXR0cignY2xhc3MnLCAnc3RlcCcpXG4gICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyBcbiAgICAgICAgdmFyIHggPSBkLnggKyByYWRpdXMgKyBvZmZzZXQ7XG4gICAgICAgIHZhciB5ID0gZC55ICsgcmFkaXVzICsgb2Zmc2V0O1xuICAgICAgICByZXR1cm4gJ3RyYW5zbGF0ZSgnICsgeCArICcsICcgKyB5ICsgJyknfSlcblxuXG4gICAgICAgIC8vIGZlYXR1cmVfZW50ZXIuYXBwZW5kKCdjaXJjbGUnKVxuICAgICAgICAvLyAuYXR0cigncicsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcmFkaXVzfSlcbiAgICAgICAgLy8gLnN0eWxlKCdmaWxsJywgJ3doaXRlJylcbiAgICAgICAgLy8gLnN0eWxlKCdzdHJva2UnLCAnYmxhY2snKVxuICAgICAgICAvLyAuc3R5bGUoJ3N0cm9rZS13aWR0aCcsICc0cHgnKTtcblxuICAgICAgICBmZWF0dXJlX2VudGVyLmFwcGVuZCgndGV4dCcpXG4gICAgICAgICAgLmF0dHIoJ3knLCAtIHJhZGl1cylcbiAgICAgICAgICAuYXR0cignZHknLCAnLjcxZW0nKVxuICAgICAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnbWlkZGxlJylcbiAgICAgICAgICAudGV4dChmdW5jdGlvbihkLCBpKSB7IHJldHVybiBpICsgMX0pO1xuXG4gICAgdmFyIGxicDEgPSBbMCwgMCwgMjAwLFxuICAgICAgICAgICAgICAgIDQwLCAxMDAsIDQwLFxuICAgICAgICAgICAgICAgIDE2MCwgIDE2MCAsMTYwXTtcbiAgICBmMSA9IGZlYXR1cmUuc2VsZWN0QWxsKCcuZmlnMScpLmRhdGEobGJwMSlcbiAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAuYXR0cignY2xhc3MnLCAnZmlnMScpXG4gICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnKzgwICsgJywgJyArIDgwKycpJyk7XG5cbiAgICAgIGYxLmFwcGVuZCgncmVjdCcpXG4gICAgICAuYXR0cigneCcsIGZ1bmN0aW9uKGQsIGkpIHtyZXR1cm4gcHJvcHMuZmVhdHVyZS53LzI0ICogKGNlbGxfd2lkdGgqKGklMykpfSlcbiAgICAgIC5hdHRyKCd5JywgZnVuY3Rpb24oZCwgaSkge3JldHVybiBwcm9wcy5mZWF0dXJlLncvMjQgKiAoY2VsbF9oZWlnaHQqTWF0aC5mbG9vcihpLzMpKX0pXG4gICAgICAuYXR0cignd2lkdGgnLCBmdW5jdGlvbihkKSB7cmV0dXJuIHByb3BzLmZlYXR1cmUudy8yNCAqIGNlbGxfd2lkdGh9KVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuZmVhdHVyZS5oLzI0ICogY2VsbF9oZWlnaHR9KVxuICAgICAgLnN0eWxlKCdmaWxsJywgZnVuY3Rpb24oZCkge3JldHVybiBkMy5yZ2IoZCxkLGQpO30pXG4gICAgICAuc3R5bGUoJ2ZpbGwtb3BhY2l0eScsIDAuNSlcbiAgICAgIC5zdHlsZSgnc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgIC5zdHlsZSgnc3Ryb2tlLXdpZHRoJywgJzJweCcpXG4gICAgICAuc3R5bGUoJ3N0cm9rZS1vcGFjaXR5JywgMS4wKVxuXG4gICAgdmFyIGxicDIgPSBbMCwgMCwgMSxcbiAgICAgICAgICAgICAgICAwLCAnICcsIDAsXG4gICAgICAgICAgICAgICAgMSwgIDEgLDFdO1xuXG4gICAgZjIgPSBmZWF0dXJlLnNlbGVjdEFsbCgnLmZpZzInKS5kYXRhKGxicDIpXG4gICAgICAuZW50ZXIoKS5hcHBlbmQoJ2cnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ2ZpZzInKVxuICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyszNDAgKyAnLCAnICsgODArJyknKTtcblxuICAgICAgZjIuYXBwZW5kKCdyZWN0JylcbiAgICAgIC5hdHRyKCd4JywgZnVuY3Rpb24oZCwgaSkge3JldHVybiBwcm9wcy5mZWF0dXJlLncvMjQgKiAoY2VsbF93aWR0aCooaSUzKSl9KVxuICAgICAgLmF0dHIoJ3knLCBmdW5jdGlvbihkLCBpKSB7cmV0dXJuIHByb3BzLmZlYXR1cmUudy8yNCAqIChjZWxsX2hlaWdodCpNYXRoLmZsb29yKGkvMykpfSlcbiAgICAgIC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gcHJvcHMuZmVhdHVyZS53LzI0ICogY2VsbF93aWR0aH0pXG4gICAgICAuYXR0cignaGVpZ2h0JywgZnVuY3Rpb24oZCkge3JldHVybiBwcm9wcy5mZWF0dXJlLmgvMjQgKiBjZWxsX2hlaWdodH0pXG4gICAgICAuc3R5bGUoJ2ZpbGwnLCAnd2hpdGUnKVxuICAgICAgLnN0eWxlKCdmaWxsLW9wYWNpdHknLCAwLjUpXG4gICAgICAuc3R5bGUoJ3N0cm9rZScsICdibGFjaycpXG4gICAgICAuc3R5bGUoJ3N0cm9rZS13aWR0aCcsICcycHgnKVxuICAgICAgLnN0eWxlKCdzdHJva2Utb3BhY2l0eScsIDEuMClcblxuICAgICAgZjIuYXBwZW5kKCd0ZXh0JylcbiAgICAgICAgLmF0dHIoJ3gnLCBmdW5jdGlvbihkLCBpKSB7cmV0dXJuIHByb3BzLmZlYXR1cmUudy8yNCAqIChjZWxsX3dpZHRoKihpJTMpKX0pXG4gICAgICAgIC5hdHRyKCd5JywgZnVuY3Rpb24oZCwgaSkge3JldHVybiBwcm9wcy5mZWF0dXJlLncvMjQgKiAoY2VsbF9oZWlnaHQqTWF0aC5mbG9vcihpLzMpKX0pXG4gICAgICAgIC5hdHRyKCdkeScsICcxLjJlbScpXG4gICAgICAgIC5hdHRyKCdkeCcsICcwLjRlbScpXG4gICAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzI0cHgnKVxuICAgICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgICAgLnRleHQoZnVuY3Rpb24oZCkgeyByZXR1cm4gZH0pO1xuXG5cbiAgICBmZWF0dXJlLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigneCcsIDMyMClcbiAgICAgIC5hdHRyKCd5JywgMjIwKVxuICAgICAgLmF0dHIoJ2R5JywgJy44MWVtJylcbiAgICAgIC5hdHRyKCdkeCcsICcuMWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuICAgICAgLnN0eWxlKCdmb250LXNpemUnLCAnMTZweCcpXG4gICAgICAudGV4dCgnXCIwMDEwMTExMFwiID09IDU2Jyk7XG5cbiAgICBcbiAgICBmZWF0dXJlLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigneCcsIHhfZWRnZSlcbiAgICAgIC5hdHRyKCd5JywgeV9zdGFydClcbiAgICAgIC5hdHRyKCdkeScsICcuODFlbScpXG4gICAgICAuYXR0cignZHgnLCAnLjFlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzE2JylcbiAgICAgIC50ZXh0KCdpZiAoTFVUWzU2XSkgeycpO1xuXG4gICAgZmVhdHVyZS5hcHBlbmQoJ3RleHQnKVxuICAgICAgLmF0dHIoJ3gnLCB4X25leHQpXG4gICAgICAuYXR0cigneScsIHlfc3RhcnQgKyB5X2xpbmUqMSlcbiAgICAgIC5hdHRyKCdkeScsICcuODFlbScpXG4gICAgICAuYXR0cignZHgnLCAnLjFlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ3N0YXJ0JylcbiAgICAgIC5zdHlsZSgnZm9udC1zaXplJywgJzE2JylcbiAgICAgIC50ZXh0KCcgVkFMVUUgPSBQQVNTJyk7XG5cbiAgICBmZWF0dXJlLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigneCcsIHhfZWRnZSlcbiAgICAgIC5hdHRyKCd5JywgeV9zdGFydCArIHlfbGluZSoyKVxuICAgICAgLmF0dHIoJ2R5JywgJy44MWVtJylcbiAgICAgIC5hdHRyKCdkeCcsICcuMWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuICAgICAgLnN0eWxlKCdmb250LXNpemUnLCAnMTYnKVxuICAgICAgLnRleHQoJ30gZWxzZSB7Jyk7XG5cbiAgICBmZWF0dXJlLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigneCcsIHhfbmV4dClcbiAgICAgIC5hdHRyKCd5JywgeV9zdGFydCArIHlfbGluZSozKVxuICAgICAgLmF0dHIoJ2R5JywgJy44MWVtJylcbiAgICAgIC5hdHRyKCdkeCcsICcuMWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuICAgICAgLnN0eWxlKCdmb250LXNpemUnLCAnMTYnKVxuICAgICAgLnRleHQoJyBWQUxVRSA9IEZBSUwnKTtcblxuICAgIGZlYXR1cmUuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCd4JywgeF9lZGdlKVxuICAgICAgLmF0dHIoJ3knLCB5X3N0YXJ0ICsgeV9saW5lKjQpXG4gICAgICAuYXR0cignZHknLCAnLjgxZW0nKVxuICAgICAgLmF0dHIoJ2R4JywgJy4xZW0nKVxuICAgICAgLnN0eWxlKCd0ZXh0LWFuY2hvcicsICdzdGFydCcpXG4gICAgICAuc3R5bGUoJ2ZvbnQtc2l6ZScsICcxNicpXG4gICAgICAudGV4dCgnfScpO1xuXG5cbiAgICBmZWF0dXJlLmFwcGVuZCgndGV4dCcpXG4gICAgICAuYXR0cigneCcsIDMyMClcbiAgICAgIC5hdHRyKCd5JywgeV9zdGFydCArIHlfbGluZSoxKVxuICAgICAgLmF0dHIoJ2R5JywgJy44MWVtJylcbiAgICAgIC5hdHRyKCdkeCcsICcuMWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnc3RhcnQnKVxuICAgICAgLnN0eWxlKCdmb250LXNpemUnLCAnMTYnKVxuICAgICAgLnRleHQoJ1NUQUdFICs9IFZBTFVFJyk7XG5cbiAgICB2YXIgZXZlcnkxNSA9IEFycmF5LmFwcGx5KG51bGwsIEFycmF5KDI1NS8xNSArIDEpKS5tYXAoZnVuY3Rpb24oXywgaSkge3JldHVybiBpICogMTU7fSkucmV2ZXJzZSgpO1xuXG4gICAgaWYgKHByb3BzLmxlZ2VuZCkge1xuICAgICAgdmFyIGxlZ2VuZCA9IGNoYXJ0LnNlbGVjdEFsbCgnLmxlZ2VuZCcpXG4gICAgICAgICAgICAuZGF0YShjb2xvci50aWNrcygxMCkucmV2ZXJzZSgpKVxuICAgICAgICAgICAgLy8gLmRhdGEoZXZlcnkxNSlcbiAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnbGVnZW5kJylcbiAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkLCBpKSB7cmV0dXJuICd0cmFuc2xhdGUoJyArICh3aWR0aCArIDIwKSArICcsJyArICgxMCArIGkgKjIwKSArICcpJzt9KTtcblxuXG4gICAgICBsZWdlbmQuYXBwZW5kKFwicmVjdFwiKVxuICAgICAgICAuYXR0cihcIndpZHRoXCIsIDIwKVxuICAgICAgICAuYXR0cihcImhlaWdodFwiLCAyMClcbiAgICAgICAgLnN0eWxlKFwic3Ryb2tlXCIsIGZ1bmN0aW9uIChkKSB7IHJldHVybiBcImJsYWNrXCI7fSlcbiAgICAgICAgLnN0eWxlKFwiZmlsbFwiLCBjb2xvcilcblxuICAgICAgdmFyIGxlZ2VuZEZvcm1hdCA9IGQzLmZvcm1hdCgpO1xuICAgICAgaWYocHJvcHMucGVyY2VudCkge1xuICAgICAgICBsZWdlbmRGb3JtYXQgPSBkMy5mb3JtYXQoJyUnKTtcbiAgICAgIH1cblxuICAgICAgbGVnZW5kLmFwcGVuZChcInRleHRcIilcbiAgICAgICAgLmF0dHIoXCJ4XCIsIDI2KVxuICAgICAgICAuYXR0cihcInlcIiwgMTApXG4gICAgICAgIC5hdHRyKFwiZHlcIiwgXCIuMzVlbVwiKVxuICAgICAgICAudGV4dChmdW5jdGlvbihkKSB7cmV0dXJuIGxlZ2VuZEZvcm1hdChkKTt9KTtcbiAgICB9XG5cbiAgICBpZiAocHJvcHMuZ3JpZCkge1xuICAgICAgaWYgKHByb3BzLmF4aXMpIHtcbiAgICAgICAgY2hhcnQuYXBwZW5kKCdnJylcbiAgICAgICAgICAuYXR0cignY2xhc3MnLCAneCBheGlzJylcbiAgICAgICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIit3aWR0aC8zLzIvKGRhdGFbMF0ubGVuZ3RoKStcIiwgXCIgKyBoZWlnaHQgKyBcIilcIilcbiAgICAgICAgICAuY2FsbChheGlzLngpO1xuXG4gICAgICAgIGNoYXJ0LmFwcGVuZChcImdcIilcbiAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwieSBheGlzXCIpXG4gICAgICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwgXCIgICsgLSBoZWlnaHQvMy9kYXRhLmxlbmd0aCArIFwiKVwiKVxuICAgICAgICAgIC5jYWxsKGF4aXMueSk7XG4gICAgICB9XG5cbiAgICBjaGFydC5zZWxlY3RBbGwoXCJsaW5lLnlncmlkXCIpXG4gICAgICAuZGF0YShzY2FsZXMueS50aWNrcyg2KSlcbiAgICAuZW50ZXIoKVxuICAgICAgLmFwcGVuZChcImxpbmVcIilcbiAgICAgIC5hdHRyKFxuICAgICAgICAgICB7XG4gICAgICAgICAgIFwiY2xhc3NcIjpcInlncmlkXCIsXG4gICAgICAgICAgIFwieDFcIiA6IDAsXG4gICAgICAgICAgIFwieDJcIiA6IHdpZHRoLzIsXG4gICAgICAgICAgIFwieTFcIiA6IGZ1bmN0aW9uKGQpeyByZXR1cm4gc2NhbGVzLnkoZCk7fSxcbiAgICAgICAgICAgXCJ5MlwiIDogZnVuY3Rpb24oZCl7IHJldHVybiBzY2FsZXMueShkKTt9LFxuICAgICAgICAgICBcImZpbGxcIiA6IFwibm9uZVwiLFxuICAgICAgICAgICBcInNoYXBlLXJlbmRlcmluZ1wiIDogXCJjcmlzcEVkZ2VzXCIsXG4gICAgICAgICAgIFwic3Ryb2tlXCIgOiBcImJsYWNrXCIsXG4gICAgICAgICAgIFwic3Ryb2tlLXdpZHRoXCIgOiBcIjJweFwiXG4gICAgICAgICAgIH0pO1xuXG4gICAgY2hhcnQuc2VsZWN0QWxsKFwibGluZS54Z3JpZFwiKVxuICAgICAgLmRhdGEoc2NhbGVzLngudGlja3MoNikpXG4gICAgLmVudGVyKClcbiAgICAgIC5hcHBlbmQoXCJsaW5lXCIpXG4gICAgICAuYXR0cihcbiAgICAgICAgICAge1xuICAgICAgICAgICBcImNsYXNzXCI6XCJ4Z3JpZFwiLFxuICAgICAgICAgICBcInkxXCIgOiAwLFxuICAgICAgICAgICBcInkyXCIgOiBoZWlnaHQsXG4gICAgICAgICAgIFwieDFcIiA6IGZ1bmN0aW9uKGQpeyByZXR1cm4gc2NhbGVzLngoZCk7fSxcbiAgICAgICAgICAgXCJ4MlwiIDogZnVuY3Rpb24oZCl7IHJldHVybiBzY2FsZXMueChkKTt9LFxuICAgICAgICAgICBcImZpbGxcIiA6IFwibm9uZVwiLFxuICAgICAgICAgICBcInNoYXBlLXJlbmRlcmluZ1wiIDogXCJjcmlzcEVkZ2VzXCIsXG4gICAgICAgICAgIFwic3Ryb2tlXCIgOiBcImJsYWNrXCIsXG4gICAgICAgICAgIFwic3Ryb2tlLXdpZHRoXCIgOiBcIjJweFwiXG4gICAgICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocHJvcHMuYXhpcykge1xuICAgICAgICBjaGFydC5hcHBlbmQoJ2cnKVxuICAgICAgICAgIC5hdHRyKCdjbGFzcycsICd4IGF4aXMnKVxuICAgICAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsIFwiICsgaGVpZ2h0ICsgXCIpXCIpXG4gICAgICAgICAgLmNhbGwoYXhpcy54KTtcblxuICAgICAgICBjaGFydC5hcHBlbmQoXCJnXCIpXG4gICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInkgYXhpc1wiKVxuICAgICAgICAgIC5jYWxsKGF4aXMueSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZHJhd0ltYWdlKGNhbnZhcywgZGF0YSkge1xuICAgIHZhciBjb250ZXh0ID0gY2FudmFzLm5vZGUoKS5nZXRDb250ZXh0KFwiMmRcIiksXG4gICAgICBpbWFnZSA9IGNvbnRleHQuY3JlYXRlSW1hZ2VEYXRhKGR4LGR5KTtcbiAgICBmb3IgKHZhciB5ID0gMCwgcCA9IC0xOyB5IDwgZHk7ICsreSkge1xuICAgICAgZm9yICh2YXIgeCA9IDA7IHggPCBkeDsgKyt4KSB7XG4gICAgICAgIGlmKGRhdGFbeV1beF0gPT0gLTEpIHtcbiAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAwO1xuICAgICAgICAgIGltYWdlLmRhdGFbKytwXSA9IDA7XG4gICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMDtcbiAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBjID0gZDMucmdiKGNvbG9yKGRhdGFbeV1beF0pKTtcbiAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSBjLnI7XG4gICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gYy5nO1xuICAgICAgICAgIGltYWdlLmRhdGFbKytwXSA9IGMuYjtcbiAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAyNTU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29udGV4dC5wdXRJbWFnZURhdGEoaW1hZ2UsIDAsIDApO1xuICB9XG5cbiAgZnVuY3Rpb24gZHJhd0ltYWdlUm93QmxvY2soY2FudmFzLCBkYXRhLCB5YmxvY2sseGJsb2NrKSB7XG4gICAgdmFyIHRvdGFsID0gMDtcbiAgICB2YXIgY29udGV4dCA9IGNhbnZhcy5ub2RlKCkuZ2V0Q29udGV4dChcIjJkXCIpLFxuICAgICAgaW1hZ2UgPSBjb250ZXh0LmNyZWF0ZUltYWdlRGF0YShkeCxkeSk7XG4gICAgaWYgKHlibG9jayA9PSAxICYmIHhibG9jayA9PSAxKSB7XG4gICAgICBmb3IgKHZhciB5ID0gMCwgcCA9IC0xOyB5IDwgZHk7ICsreSkge1xuICAgICAgICBmb3IgKHZhciB4ID0gMDsgeCA8IGR4OyArK3gpIHtcbiAgICAgICAgICBpZihkYXRhW3ldW3hdID09IC0xKSB7XG4gICAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAwO1xuICAgICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMDtcbiAgICAgICAgICAgIGltYWdlLmRhdGFbKytwXSA9IDA7XG4gICAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgYyA9IGQzLnJnYihjb2xvcihkYXRhW3ldW3hdKSk7XG4gICAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSBjLnI7XG4gICAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSBjLmc7XG4gICAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSBjLmI7XG4gICAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAyNTU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAodmFyIHkgPSAwLCBwID0gLTE7IHkgPCBkeTsgeSs9eWJsb2NrKSB7XG4gICAgICAgIGZvciAodmFyIHggPSAwOyB4IDwgZHg7IHgrPXhibG9jaykge1xuICAgICAgICAgIHZhciBtYXggPSAwO1xuICAgICAgICAgIGZvciAodmFyIHliID0gMDsgeWIgPCB5YmxvY2sgJiYgeWIreSA8IGR5OyArK3liKSB7XG4gICAgICAgICAgICB2YXIgcm93X21heCA9IDA7XG4gICAgICAgICAgICBmb3IgKHZhciB4YiA9IDA7IHhiIDwgeGJsb2NrICYmIHhiK3ggPCBkeDsgKyt4Yikge1xuICAgICAgICAgICAgICBpZiAoZGF0YVt5K3liXVt4K3hiXSA+IHJvd19tYXgpIHtcbiAgICAgICAgICAgICAgICByb3dfbWF4ID0gZGF0YVt5K3liXVt4K3hiXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJvd19tYXggPiBtYXgpIHtcbiAgICAgICAgICAgICAgbWF4ID0gcm93X21heDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yICh2YXIgeWIgPSAwOyB5YiA8IHlibG9jayAmJiB5Yit5IDwgZHk7ICsreWIpIHtcbiAgICAgICAgICAgIGZvciAodmFyIHhiID0gMDsgeGIgPCB4YmxvY2sgJiYgeGIreCA8IGR4OyArK3hiKSB7XG4gICAgICAgICAgICAgIHZhciBjID0gZDMucmdiKGNvbG9yKG1heCkpO1xuICAgICAgICAgICAgICB2YXIgcG9zID0gKHkreWIpKjQgKiBkeCArICh4K3hiKSo0O1xuICAgICAgICAgICAgICBpbWFnZS5kYXRhW3BvcysrXSA9IGMucjtcbiAgICAgICAgICAgICAgaW1hZ2UuZGF0YVtwb3MrK10gPSBjLmc7XG4gICAgICAgICAgICAgIGltYWdlLmRhdGFbcG9zKytdID0gYy5iO1xuICAgICAgICAgICAgICBpbWFnZS5kYXRhW3BvcysrXSA9IDI1NTtcbiAgICAgICAgICAgICAgdG90YWwgKz0gbWF4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb250ZXh0LnB1dEltYWdlRGF0YShpbWFnZSwgMCwgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBkcmF3U2VhcmNoV2luZG93KGNhbnZhcywgb3JpZ193LCBvcmlnX2gsIGZhY3RvciwgaXRlcmF0aW9uLCBsb2MpIHtcbiAgICB2YXIgc2NhbGUgPSBNYXRoLnBvdyhmYWN0b3IsIGl0ZXJhdGlvbik7XG4gICAgdmFyIGNvbnRleHQgPSBjYW52YXMubm9kZSgpLmdldENvbnRleHQoXCIyZFwiKTtcbiAgICBjb250ZXh0Lmdsb2JhbEFscGhhID0gMS4wO1xuXG4gICAgaWYgKG5zLl9pbWdSZWFkeSkge1xuICAgICAgY29uc29sZS5sb2cobnMuX2ltZ1JlYWR5KTtcbiAgICAgIHZhciBzcmMgPSB7eDogbG9jLngqc2NhbGUsIHk6IGxvYy55KnNjYWxlLCB3OiBsb2MudypzY2FsZSwgaDogbG9jLmgqc2NhbGV9O1xuICAgICAgdmFyIGRlc3QgID0ge3g6IDAsIHk6IDAsIHc6IG9yaWdfdywgaDogb3JpZ19ofTtcbiAgICAgIGNvbnRleHQuZHJhd0ltYWdlKG5zLl9pbWcsIHNyYy54LCBzcmMueSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzcmMudywgc3JjLmgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzdC54LCBkZXN0LnksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzdC53LCBkZXN0LmgpO1xuICAgIH1cbiAgfVxuXG59O1xuXG5ucy5kZXN0cm95ID0gZnVuY3Rpb24oZWwpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5zO1xuIiwicmVxdWlyZSgnLi9kM1Bvcy5sZXNzJyk7XG5yZXF1aXJlKCcuL2QzQXhpcy5sZXNzJyk7XG5cbnZhciBucyA9IHt9O1xuXG5ucy5fbWFyZ2luID0ge3RvcDogMjAsIHJpZ2h0OiA5MCwgYm90dG9tOiA2MCwgbGVmdDogNzB9OyBcblxubnMuX3dpZHRoID0gZnVuY3Rpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLndpZHRoIC0gdGhpcy5fbWFyZ2luLmxlZnQgLSB0aGlzLl9tYXJnaW4ucmlnaHQ7XG59XG5cbm5zLl9oZWlnaHQgPSBmdW5jdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuaGVpZ2h0IC0gdGhpcy5fbWFyZ2luLnRvcCAtIHRoaXMuX21hcmdpbi5ib3R0b207XG59XG5cbm5zLmNyZWF0ZSA9IGZ1bmN0aW9uKGVsLCBwcm9wcywgc3RhdGUpIHtcbiAgY29udGFpbmVyID0gZDMuc2VsZWN0KGVsKS5hcHBlbmQoJ2RpdicpXG4gICAgLmF0dHIoJ2NsYXNzJywgJ3JlbCcpXG4gICAgLnN0eWxlKCd3aWR0aCcsIHByb3BzLndpZHRoICsgXCJweFwiKVxuICAgIC5zdHlsZSgnaGVpZ2h0JywgcHJvcHMuaGVpZ2h0ICsgXCJweFwiKVxuXG5cbiAgY29udGFpbmVyLmFwcGVuZCgnZGl2JylcbiAgLmF0dHIoJ2NsYXNzJywgJ2FicycpXG4gICAgLnN0eWxlKCd3aWR0aCcsIHRoaXMuX3dpZHRoKHByb3BzKSArIFwicHhcIilcbiAgICAuc3R5bGUoJ2hlaWdodCcsIHRoaXMuX2hlaWdodChwcm9wcykgKyBcInB4XCIpXG4gIC5zdHlsZSgnbGVmdCcsIHRoaXMuX21hcmdpbi5sZWZ0ICsgXCJweFwiKVxuICAuc3R5bGUoJ3RvcCcsIHRoaXMuX21hcmdpbi50b3AgKyBcInB4XCIpXG4gICAgLmFwcGVuZCgnY2FudmFzJylcbiAgICAuc3R5bGUoJ3dpZHRoJywgdGhpcy5fd2lkdGgocHJvcHMpICsgXCJweFwiKVxuICAgIC5zdHlsZSgnaGVpZ2h0JywgdGhpcy5faGVpZ2h0KHByb3BzKSArIFwicHhcIilcbiAgICAuYXR0cignY2xhc3MnLCAnaW1hZ2UgYWJzJyk7XG5cbiAgY29udGFpbmVyLmFwcGVuZCgnZGl2JylcbiAgLmF0dHIoJ2NsYXNzJywgJ2FicycpXG4gICAgLnN0eWxlKCd3aWR0aCcsIHRoaXMuX3dpZHRoKHByb3BzKSArIFwicHhcIilcbiAgICAuc3R5bGUoJ2hlaWdodCcsIHRoaXMuX2hlaWdodChwcm9wcykgKyBcInB4XCIpXG4gIC5zdHlsZSgnbGVmdCcsIHRoaXMuX21hcmdpbi5sZWZ0ICsgXCJweFwiKVxuICAuc3R5bGUoJ3RvcCcsIHRoaXMuX21hcmdpbi50b3AgKyBcInB4XCIpXG4gICAgLmFwcGVuZCgnY2FudmFzJylcbiAgICAuc3R5bGUoJ3dpZHRoJywgdGhpcy5fd2lkdGgocHJvcHMpICsgXCJweFwiKVxuICAgIC5zdHlsZSgnaGVpZ2h0JywgdGhpcy5faGVpZ2h0KHByb3BzKSArIFwicHhcIilcbiAgICAuYXR0cignY2xhc3MnLCAnaGVhdG1hcCBhYnMnKVxuICAgIC5jbGFzc2VkKCdwaXhlbGF0ZWQnLCBwcm9wcy5waXhlbGF0ZWQpO1xuXG4gY29udGFpbmVyLmFwcGVuZCgnc3ZnJylcbiAgICAuYXR0cignY2xhc3MnLCAnYWJzJylcbiAgICAuYXR0cignd2lkdGgnLCBwcm9wcy53aWR0aClcbiAgICAuYXR0cignaGVpZ2h0JywgcHJvcHMuaGVpZ2h0KVxuICAgIC5hcHBlbmQoJ2cnKVxuICAgIC5hdHRyKCdjbGFzcycsICdjaGFydCcpXG4gICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHRoaXMuX21hcmdpbi5sZWZ0ICsgJywnICsgdGhpcy5fbWFyZ2luLnRvcCArICcpJyk7XG5cblxuICB0aGlzLnVwZGF0ZShlbCwgcHJvcHMsIHN0YXRlKTtcbn1cblxubnMuX2F4aXMgPSBmdW5jdGlvbihzY2FsZXMpIHtcbiAgdmFyIHggPSBkMy5zdmcuYXhpcygpXG4gICAgICAgICAgICAgIC5zY2FsZShzY2FsZXMueClcbiAgICAgICAgICAgICAgLnRpY2tWYWx1ZXMoWzEsMiwzLDQsNSw2XSlcbiAgICAgICAgICAgICAgLnRpY2tGb3JtYXQoZDMuZm9ybWF0KFwiZFwiKSlcbiAgICAgICAgICAgICAgLm9yaWVudCgnYm90dG9tJyk7XG5cbiAgdmFyIHkgPSBkMy5zdmcuYXhpcygpXG4gICAgICAgICAgICAgIC5zY2FsZShzY2FsZXMueSlcbiAgICAgICAgICAgICAgLnRpY2tWYWx1ZXMoWzEsMiwzLDQsNSw2XSlcbiAgICAgICAgICAgICAgLnRpY2tGb3JtYXQoZDMuZm9ybWF0KFwiZFwiKSlcbiAgICAgICAgICAgICAgLm9yaWVudCgnbGVmdCcpO1xuXG4gIHJldHVybiB7eDogeCwgeTogeX07XG59XG5cbm5zLl9zY2FsZXMgPSBmdW5jdGlvbihwcm9wcykge1xuICB3aWR0aCA9IHRoaXMuX3dpZHRoKHByb3BzKTtcbiAgaGVpZ2h0ID0gdGhpcy5faGVpZ2h0KHByb3BzKTtcblxuICB2YXIgeSA9IGQzLnNjYWxlLmxpbmVhcigpXG4gICAgICAgICAgLnJhbmdlKFtoZWlnaHQsIDBdKTtcbiAgdmFyIHggPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAgIC5yYW5nZShbMCwgd2lkdGhdKTtcblxuICByZXR1cm4ge3g6IHgsIHk6IHl9O1xufVxuXG5ucy51cGRhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMsIHN0YXRlKSB7XG4gIHZhciBtYXJnaW4gPSB0aGlzLl9tYXJnaW47XG4gIHZhciB3aWR0aCA9IHRoaXMuX3dpZHRoKHByb3BzKTtcbiAgdmFyIGhlaWdodCA9IHRoaXMuX2hlaWdodChwcm9wcyk7XG4gIHZhciBzY2FsZXMgPSB0aGlzLl9zY2FsZXMocHJvcHMpO1xuICB2YXIgYXhpcyA9IHRoaXMuX2F4aXMoc2NhbGVzKTtcblxuICB2YXIgZGF0YSA9IG51bGxcbiAgaWYgKHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5sZW5ndGggPiAwICYmIEFycmF5LmlzQXJyYXkoc3RhdGUuZGF0YVswXSkpIHtcbiAgICBkYXRhID0gc3RhdGUuZGF0YTtcbiAgfSBlbHNlIHtcbiAgICBmb3IgKHZhciBpIGluIHN0YXRlLmRhdGEpIHtcbiAgICAgIGlmIChzdGF0ZS5kYXRhW2ldLnNjYWxlID09IHByb3BzLnNjYWxlKSB7XG4gICAgICAgIGRhdGEgPSBzdGF0ZS5kYXRhW2ldLmRhdGE7XG4gICAgICB9XG4gICAgfVxuICB9XG5cblxuICBpZiAoZGF0YSkge1xuXG4gICAgaWYgKHByb3BzLnBlcmNlbnQpIHtcbiAgICAgIHZhciBzdW0gPSBkMy5zdW0oZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gZDMuc3VtKGQpOyB9KTtcbiAgICAgIGRhdGEgPSBkYXRhLm1hcChmdW5jdGlvbihkKSB7IHJldHVybiBkLm1hcChmdW5jdGlvbihkKSB7cmV0dXJuIDEuMCAqIGQgLyBzdW07fSk7IH0pO1xuICAgICAgZGF0YSA9IGRhdGEucmV2ZXJzZSgpO1xuICAgIH1cblxuICAgIHZhciBkeCA9IGRhdGFbMF0ubGVuZ3RoO1xuICAgIHZhciBkeSA9IGRhdGEubGVuZ3RoO1xuXG4gICAgdmFyIHN0YXJ0ID0gMTtcbiAgICBzY2FsZXMueC5kb21haW4oW3N0YXJ0LCBkeCtzdGFydF0pO1xuICAgIHNjYWxlcy55LmRvbWFpbihbc3RhcnQsIGR5K3N0YXJ0XSk7XG5cbiAgICB2YXIgY29sb3JEb21haW4gPSBbMCwgZDMubWF4KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQzLm1heChkKTt9KV07XG4gICAgaWYgKHByb3BzLnBlcmNlbnQpIHtcbiAgICAgIGNvbG9yRG9tYWluID0gWzAsIDAuMDUsIDFdO1xuICAgICAgY29sb3JSYW5nZSA9IFsncmdiKDI1NSwyNTUsMjU1KScsJ3JnYigyNTUsMjU1LDIxNyknLCdyZ2IoMjM3LDI0OCwxNzcpJywncmdiKDE5OSwyMzMsMTgwKScsJ3JnYigxMjcsMjA1LDE4NyknLCdyZ2IoNjUsMTgyLDE5NiknLCdyZ2IoMjksMTQ1LDE5MiknLCdyZ2IoMzQsOTQsMTY4KScsJ3JnYigzNyw1MiwxNDgpJywncmdiKDgsMjksODgpJ107XG4gICAgICBjb2xvclJhbmdlID0gWydyZ2IoMjU1LDI1NSwyNTUpJywgJ3JnYigxMjcsMjA1LDE4NyknLCAncmdiKDgsMjksODgpJ107XG4gICAgfVxuICAgIHZhciBjb2xvcjtcbiAgICBpZiAocHJvcHMuZ3JleSkge1xuICAgICAgY29sb3IgPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAgICAgICAgICAgLmRvbWFpbihjb2xvckRvbWFpbilcbiAgICAgICAgICAgICAgICAgIC8vIC5yYW5nZShbXCIjMDAwMDAwXCIsXCIjZmZmZmZmXCJdLnJldmVyc2UoKSk7XG4gICAgICAgICAgICAgICAgICAucmFuZ2UoW1wiIzAwMDAwMFwiLFwiI2ZmZmZmZlwiXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbG9yID0gZDMuc2NhbGUubGluZWFyKClcbiAgICAgICAgICAgICAgICAgIC5kb21haW4oY29sb3JEb21haW4pXG4gICAgICAgICAgICAgICAgICAucmFuZ2UoY29sb3JSYW5nZSk7XG4gICAgfVxuXG4gICAgdmFyIGNoYXJ0ID0gZDMuc2VsZWN0KGVsKS5zZWxlY3QoJy5jaGFydCcpO1xuXG4gICAgLy8gY2hhcnQuYXBwZW5kKCdnJylcbiAgICAvLyAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHdpZHRoLzIgKyAnLCcgKyBoZWlnaHQgKyAgJyknKVxuICAgIC8vICAgICAuYXBwZW5kKCd0ZXh0JylcbiAgICAvLyAgICAgLmF0dHIoJ2NsYXNzJywgJ2F4aXMnKVxuICAgIC8vICAgICAuYXR0cigndGV4dC1hbmNob3InLCAnbWlkZGxlJylcbiAgICAvLyAgICAgLmF0dHIoXCJkeVwiLCBcIjIuMzVlbVwiKVxuICAgIC8vICAgICAudGV4dCgnV2lkdGgnKTtcblxuICAgIC8vIGNoYXJ0LmFwcGVuZCgnZycpXG4gICAgLy8gICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyAtNzAgKyAnLCcgKyBoZWlnaHQvMiArICAnKScpXG4gICAgLy8gICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgIC8vICAgICAuYXR0cignY2xhc3MnLCAnYXhpcycpXG4gICAgLy8gICAgIC5hdHRyKCd0ZXh0LWFuY2hvcicsICdtaWRkbGUnKVxuICAgIC8vICAgICAuYXR0cigndHJhbnNmb3JtJywgJ3JvdGF0ZSgtOTApJylcbiAgICAvLyAgICAgLmF0dHIoXCJkeVwiLCBcIjIuMzVlbVwiKVxuICAgIC8vICAgICAudGV4dCgnSGVpZ2h0Jyk7XG4gICAgICAgIFxuICAgIHZhciBoZWF0bWFwID0gZDMuc2VsZWN0KGVsKS5zZWxlY3QoJy5oZWF0bWFwJylcbiAgICAgICAgLmF0dHIoJ3dpZHRoJywgZHgpXG4gICAgICAgIC5hdHRyKCdoZWlnaHQnLCBkeSlcbiAgICAgICAgLmNhbGwoZnVuY3Rpb24oKSB7IGRyYXdJbWFnZVJvd0Jsb2NrKHRoaXMsIGRhdGEsIHByb3BzLnlibG9jaywgcHJvcHMueGJsb2NrKTt9KTtcblxuXG4gICAgdmFyIGV2ZXJ5MTUgPSBBcnJheS5hcHBseShudWxsLCBBcnJheSgyNTUvMTUgKyAxKSkubWFwKGZ1bmN0aW9uKF8sIGkpIHtyZXR1cm4gaSAqIDE1O30pLnJldmVyc2UoKTtcblxuICAgIGlmIChwcm9wcy5sZWdlbmQpIHtcbiAgICAgIGJveCA9IDI1O1xuICAgICAgdmFyIGxlZ2VuZCA9IGNoYXJ0LnNlbGVjdEFsbCgnLmxlZ2VuZCcpXG4gICAgICAgICAgICAuZGF0YShjb2xvci50aWNrcygxMCkucmV2ZXJzZSgpKVxuICAgICAgICAgICAgLy8gLmRhdGEoZXZlcnkxNSlcbiAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnbGVnZW5kJylcbiAgICAgICAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCBmdW5jdGlvbihkLCBpKSB7cmV0dXJuICd0cmFuc2xhdGUoJyArICh3aWR0aCArIGJveCkgKyAnLCcgKyAoaSAqYm94KSArICcpJzt9KTtcblxuXG4gICAgICBsZWdlbmQuYXBwZW5kKFwicmVjdFwiKVxuICAgICAgICAuYXR0cihcIndpZHRoXCIsIGJveClcbiAgICAgICAgLmF0dHIoXCJoZWlnaHRcIiwgYm94KVxuICAgICAgICAuc3R5bGUoXCJzdHJva2VcIiwgZnVuY3Rpb24gKGQpIHsgcmV0dXJuIFwiYmxhY2tcIjt9KVxuICAgICAgICAuc3R5bGUoXCJmaWxsXCIsIGNvbG9yKVxuXG4gICAgICB2YXIgbGVnZW5kRm9ybWF0ID0gZDMuZm9ybWF0KCk7XG4gICAgICBpZihwcm9wcy5wZXJjZW50KSB7XG4gICAgICAgIGxlZ2VuZEZvcm1hdCA9IGQzLmZvcm1hdCgnJScpO1xuICAgICAgfVxuXG4gICAgICBsZWdlbmQuYXBwZW5kKFwidGV4dFwiKVxuICAgICAgICAuYXR0cihcInhcIiwgYm94KzYpXG4gICAgICAgIC5hdHRyKFwieVwiLCAxMClcbiAgICAgICAgLmF0dHIoXCJkeVwiLCBcIi4zNWVtXCIpXG4gICAgICAgIC50ZXh0KGZ1bmN0aW9uKGQpIHtyZXR1cm4gbGVnZW5kRm9ybWF0KGQpO30pO1xuICAgIH1cblxuICAgIGlmIChwcm9wcy5ncmlkKSB7XG4gICAgICBpZiAocHJvcHMuYXhpcykge1xuICAgICAgICBjaGFydC5hcHBlbmQoJ2cnKVxuICAgICAgICAgIC5hdHRyKCdjbGFzcycsICd4IGF4aXMnKVxuICAgICAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiK3dpZHRoLzIvKGRhdGFbMF0ubGVuZ3RoKStcIiwgXCIgKyBoZWlnaHQgKyBcIilcIilcbiAgICAgICAgICAuY2FsbChheGlzLngpO1xuXG4gICAgICAgIGNoYXJ0LmFwcGVuZChcImdcIilcbiAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwieSBheGlzXCIpXG4gICAgICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwgXCIgICsgLSBoZWlnaHQvMi9kYXRhLmxlbmd0aCArIFwiKVwiKVxuICAgICAgICAgIC5jYWxsKGF4aXMueSk7XG4gICAgICB9XG5cbiAgICBjaGFydC5zZWxlY3RBbGwoXCJsaW5lLnlncmlkXCIpXG4gICAgICAuZGF0YShzY2FsZXMueS50aWNrcyg2KSlcbiAgICAuZW50ZXIoKVxuICAgICAgLmFwcGVuZChcImxpbmVcIilcbiAgICAgIC5hdHRyKFxuICAgICAgICAgICB7XG4gICAgICAgICAgIFwiY2xhc3NcIjpcInlncmlkXCIsXG4gICAgICAgICAgIFwieDFcIiA6IDAsXG4gICAgICAgICAgIFwieDJcIiA6IHdpZHRoLFxuICAgICAgICAgICBcInkxXCIgOiBmdW5jdGlvbihkKXsgcmV0dXJuIHNjYWxlcy55KGQpO30sXG4gICAgICAgICAgIFwieTJcIiA6IGZ1bmN0aW9uKGQpeyByZXR1cm4gc2NhbGVzLnkoZCk7fSxcbiAgICAgICAgICAgXCJmaWxsXCIgOiBcIm5vbmVcIixcbiAgICAgICAgICAgXCJzaGFwZS1yZW5kZXJpbmdcIiA6IFwiY3Jpc3BFZGdlc1wiLFxuICAgICAgICAgICBcInN0cm9rZVwiIDogXCJibGFja1wiLFxuICAgICAgICAgICBcInN0cm9rZS13aWR0aFwiIDogXCIycHhcIlxuICAgICAgICAgICB9KTtcblxuICAgIGNoYXJ0LnNlbGVjdEFsbChcImxpbmUueGdyaWRcIilcbiAgICAgIC5kYXRhKHNjYWxlcy54LnRpY2tzKDYpKVxuICAgIC5lbnRlcigpXG4gICAgICAuYXBwZW5kKFwibGluZVwiKVxuICAgICAgLmF0dHIoXG4gICAgICAgICAgIHtcbiAgICAgICAgICAgXCJjbGFzc1wiOlwieGdyaWRcIixcbiAgICAgICAgICAgXCJ5MVwiIDogMCxcbiAgICAgICAgICAgXCJ5MlwiIDogaGVpZ2h0LFxuICAgICAgICAgICBcIngxXCIgOiBmdW5jdGlvbihkKXsgcmV0dXJuIHNjYWxlcy54KGQpO30sXG4gICAgICAgICAgIFwieDJcIiA6IGZ1bmN0aW9uKGQpeyByZXR1cm4gc2NhbGVzLngoZCk7fSxcbiAgICAgICAgICAgXCJmaWxsXCIgOiBcIm5vbmVcIixcbiAgICAgICAgICAgXCJzaGFwZS1yZW5kZXJpbmdcIiA6IFwiY3Jpc3BFZGdlc1wiLFxuICAgICAgICAgICBcInN0cm9rZVwiIDogXCJibGFja1wiLFxuICAgICAgICAgICBcInN0cm9rZS13aWR0aFwiIDogXCIycHhcIlxuICAgICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHByb3BzLmF4aXMpIHtcbiAgICAgICAgY2hhcnQuYXBwZW5kKCdnJylcbiAgICAgICAgICAuYXR0cignY2xhc3MnLCAneCBheGlzJylcbiAgICAgICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLCBcIiArIGhlaWdodCArIFwiKVwiKVxuICAgICAgICAgIC5jYWxsKGF4aXMueCk7XG5cbiAgICAgICAgY2hhcnQuYXBwZW5kKFwiZ1wiKVxuICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ5IGF4aXNcIilcbiAgICAgICAgICAuY2FsbChheGlzLnkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXdJbWFnZShjYW52YXMsIGRhdGEpIHtcbiAgICB2YXIgY29udGV4dCA9IGNhbnZhcy5ub2RlKCkuZ2V0Q29udGV4dChcIjJkXCIpLFxuICAgICAgaW1hZ2UgPSBjb250ZXh0LmNyZWF0ZUltYWdlRGF0YShkeCxkeSk7XG4gICAgZm9yICh2YXIgeSA9IDAsIHAgPSAtMTsgeSA8IGR5OyArK3kpIHtcbiAgICAgIGZvciAodmFyIHggPSAwOyB4IDwgZHg7ICsreCkge1xuICAgICAgICBpZihkYXRhW3ldW3hdID09IC0xKSB7XG4gICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMDtcbiAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAwO1xuICAgICAgICAgIGltYWdlLmRhdGFbKytwXSA9IDA7XG4gICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgYyA9IGQzLnJnYihjb2xvcihkYXRhW3ldW3hdKSk7XG4gICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gYy5yO1xuICAgICAgICAgIGltYWdlLmRhdGFbKytwXSA9IGMuZztcbiAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSBjLmI7XG4gICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMjU1O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnRleHQucHV0SW1hZ2VEYXRhKGltYWdlLCAwLCAwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYXdJbWFnZVJvd0Jsb2NrKGNhbnZhcywgZGF0YSwgeWJsb2NrLHhibG9jaykge1xuICAgIHZhciB0b3RhbCA9IDA7XG4gICAgdmFyIGNvbnRleHQgPSBjYW52YXMubm9kZSgpLmdldENvbnRleHQoXCIyZFwiKSxcbiAgICAgIGltYWdlID0gY29udGV4dC5jcmVhdGVJbWFnZURhdGEoZHgsZHkpO1xuICAgIGlmICh5YmxvY2sgPT0gMSAmJiB4YmxvY2sgPT0gMSkge1xuICAgICAgZm9yICh2YXIgeSA9IDAsIHAgPSAtMTsgeSA8IGR5OyArK3kpIHtcbiAgICAgICAgZm9yICh2YXIgeCA9IDA7IHggPCBkeDsgKyt4KSB7XG4gICAgICAgICAgaWYoZGF0YVt5XVt4XSA9PSAtMSkge1xuICAgICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMDtcbiAgICAgICAgICAgIGltYWdlLmRhdGFbKytwXSA9IDA7XG4gICAgICAgICAgICBpbWFnZS5kYXRhWysrcF0gPSAwO1xuICAgICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGMgPSBkMy5yZ2IoY29sb3IoZGF0YVt5XVt4XSkpO1xuICAgICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gYy5yO1xuICAgICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gYy5nO1xuICAgICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gYy5iO1xuICAgICAgICAgICAgaW1hZ2UuZGF0YVsrK3BdID0gMjU1O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgfSBlbHNlIHtcbiAgICAgIGZvciAodmFyIHkgPSAwLCBwID0gLTE7IHkgPCBkeTsgeSs9eWJsb2NrKSB7XG4gICAgICAgIGZvciAodmFyIHggPSAwOyB4IDwgZHg7IHgrPXhibG9jaykge1xuICAgICAgICAgIHZhciBtYXggPSAwO1xuICAgICAgICAgIGZvciAodmFyIHliID0gMDsgeWIgPCB5YmxvY2sgJiYgeWIreSA8IGR5OyArK3liKSB7XG4gICAgICAgICAgICB2YXIgcm93X21heCA9IDA7XG4gICAgICAgICAgICBmb3IgKHZhciB4YiA9IDA7IHhiIDwgeGJsb2NrICYmIHhiK3ggPCBkeDsgKyt4Yikge1xuICAgICAgICAgICAgICBpZiAoZGF0YVt5K3liXVt4K3hiXSA+IHJvd19tYXgpIHtcbiAgICAgICAgICAgICAgICByb3dfbWF4ID0gZGF0YVt5K3liXVt4K3hiXTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJvd19tYXggPiBtYXgpIHtcbiAgICAgICAgICAgICAgbWF4ID0gcm93X21heDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZm9yICh2YXIgeWIgPSAwOyB5YiA8IHlibG9jayAmJiB5Yit5IDwgZHk7ICsreWIpIHtcbiAgICAgICAgICAgIGZvciAodmFyIHhiID0gMDsgeGIgPCB4YmxvY2sgJiYgeGIreCA8IGR4OyArK3hiKSB7XG4gICAgICAgICAgICAgIHZhciBjID0gZDMucmdiKGNvbG9yKG1heCkpO1xuICAgICAgICAgICAgICB2YXIgcG9zID0gKHkreWIpKjQgKiBkeCArICh4K3hiKSo0O1xuICAgICAgICAgICAgICBpbWFnZS5kYXRhW3BvcysrXSA9IGMucjtcbiAgICAgICAgICAgICAgaW1hZ2UuZGF0YVtwb3MrK10gPSBjLmc7XG4gICAgICAgICAgICAgIGltYWdlLmRhdGFbcG9zKytdID0gYy5iO1xuICAgICAgICAgICAgICBpbWFnZS5kYXRhW3BvcysrXSA9IDI1NTtcbiAgICAgICAgICAgICAgdG90YWwgKz0gbWF4O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb250ZXh0LnB1dEltYWdlRGF0YShpbWFnZSwgMCwgMCk7XG4gIH1cblxufTtcblxubnMuZGVzdHJveSA9IGZ1bmN0aW9uKGVsKSB7fTtcblxubW9kdWxlLmV4cG9ydHMgPSBucztcbiIsIi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG5cbi8vIHJlcXVpcmUoJy4vZDNGZWF0dXJlLmxlc3MnKTtcbnJlcXVpcmUoJy4vZDNBeGlzLmxlc3MnKTtcblxudmFyIG5zID0ge307XG5cbm5zLl93aWR0aCA9IGZ1bmN0aW9uKHByb3BzKSB7IHJldHVybiBwcm9wcy53aWR0aDsgfTtcbm5zLl9oZWlnaHQgPSBmdW5jdGlvbihwcm9wcykgeyByZXR1cm4gcHJvcHMuaGVpZ2h0OyB9O1xuXG5ucy5jcmVhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMsIHN0YXRlKSB7XG5cbiAgdmFyIHN2ZyA9IGQzLnNlbGVjdChlbCkuYXBwZW5kKCdzdmcnKVxuICAgICAgLmF0dHIoJ3dpZHRoJywgcHJvcHMud2lkdGgpXG4gICAgICAuYXR0cignaGVpZ2h0JywgcHJvcHMuaGVpZ2h0KTtcblxuICB0aGlzLnVwZGF0ZShlbCwgcHJvcHMpO1xufTtcblxubnMudXBkYXRlID0gZnVuY3Rpb24oZWwsIHByb3BzKSB7XG4gIHdpZHRoID0gdGhpcy5fd2lkdGgocHJvcHMpO1xuICBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuXG4gIHZhciByZWN0MCA9IHt4OiAwLCB5OiAwLCB3OiAzMCwgaDogMzAsIGNvbG9yOiBcIndoaXRlXCJ9O1xuICB2YXIgcmVjdDEgPSB7eDogMTUsIHk6IDE1LCB3OiAxNSwgaDogMTUsIGNvbG9yOiBcImJsYWNrXCJ9O1xuICB2YXIgcmVjdDIgPSB7eDogMCwgeTogMCwgdzogMTUsIGg6IDE1LCBjb2xvcjogXCJibGFja1wifTtcblxuICB2YXIgcmVjdDMgPSB7eDogMCwgeTogMCwgdzogNDAsIGg6IDMwLCBjb2xvcjogXCJ3aGl0ZVwifTtcbiAgdmFyIHJlY3Q0ID0ge3g6IDEwLCB5OiAwLCB3OiAyMCwgaDogMzAsIGNvbG9yOiBcImJsYWNrXCJ9O1xuXG4gIHZhciByZWN0NSA9IHt4OiAwLCB5OiAwLCB3OiA0MCwgaDogNDAsIGNvbG9yOiBcIndoaXRlXCJ9O1xuICB2YXIgcmVjdDYgPSB7eDogMCwgeTogMjAsIHc6IDQwLCBoOiAyMCwgY29sb3I6IFwiYmxhY2tcIn07XG5cbiAgdmFyIGZlYXQwID0ge3g6IDEwLCB5OiAyMCwgcmVjdHM6IFtyZWN0MCwgcmVjdDEsIHJlY3QyXX07XG4gIHZhciBmZWF0MSA9IHt4OiAyMCwgeTogNjAsIHJlY3RzOiBbcmVjdDMsIHJlY3Q0XX07XG4gIHZhciBmZWF0MiA9IHt4OiA1MCwgeTogMTAsIHJlY3RzOiBbcmVjdDUsIHJlY3Q2XX07XG5cbiAgdmFyIGZlYXR1cmVzMSA9IFtmZWF0MCwgZmVhdDEsIGZlYXQyXTtcbiAgdmFyIHdpbmRvdzEgPSB7eDogNDAsIHk6IDQwLCB3OiAxMDAsIGg6IDEwMCwgY29sb3I6IFwid2hpdGVcIiwgZmVhdHVyZXM6IGZlYXR1cmVzMSwgdGV4dDogXCJhKSBleGFtcGxlIEhhYXIgZmVhdHVyZXNcIn07XG5cblxuICB2YXIgbGJwID0gZnVuY3Rpb24odywgaCkge1xuICAgIHZhciBhcnIgPSBbXTtcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IDM7IGorKyApIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgMzsgaSsrICkge1xuICAgICAgICBhcnIucHVzaCh7eDogdyppLCB5OiBoKmosIHc6IHcsIGg6IGgsIGNvbG9yOiBcIndoaXRlXCJ9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBhcnJbNF0uY29sb3IgPSBcImJsYWNrXCI7XG4gICAgcmV0dXJuIGFycjtcbiAgfVxuXG4gIHZhciBmZWF0MyA9IHt4OiA2NCwgeTogNiwgcmVjdHM6IGxicCgxMCwgMjApfTtcbiAgdmFyIGZlYXQ0ID0ge3g6IDIwLCB5OiA3MCwgcmVjdHM6IGxicCgxMCwgOCl9O1xuICB2YXIgZmVhdDUgPSB7eDogOCwgeTogMTIsIHJlY3RzOiBsYnAoMTYsIDE2KX07XG4gIHZhciBmZWF0dXJlczEgPSBbZmVhdDMsIGZlYXQ0LCBmZWF0NV07XG4gIHZhciB3aW5kb3cyID0ge3g6IDI0MCwgeTogNDAsIHc6IDEwMCwgaDogMTAwLCBjb2xvcjogXCJ3aGl0ZVwiLCBmZWF0dXJlczogZmVhdHVyZXMxLCB0ZXh0OiBcImIpIGV4YW1wbGUgTEJQIGZlYXR1cmVzXCJ9O1xuXG4gIHdpbmRvd3MgPSBbd2luZG93MSwgd2luZG93Ml07XG5cblxuICB2YXIgd2luZG93ID0gZDMuc2VsZWN0KGVsKS5zZWxlY3RBbGwoJ3N2ZycpLnNlbGVjdEFsbCgnZycpLmRhdGEod2luZG93cylcbiAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnK2QueCArICcsJytkLnkrJyknO30pO1xuXG4gIHdpbmRvdy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQudzt9KVxuICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLmg7fSlcbiAgICAgICAgICAuYXR0cignZmlsbCcsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQuY29sb3I7fSlcbiAgICAgICAgICAuYXR0cignc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgICAgICAuYXR0cignc3Ryb2tlLXdpZHRoJywgJzJweCcpO1xuXG4gIHdpbmRvdy5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAuYXR0cignY2xhc3MnLCAnYXhpcycpXG4gICAgICAgIC5hdHRyKFwieFwiLCAwKVxuICAgICAgICAuYXR0cihcInlcIiwgMTAwICsgMjApXG4gICAgICAgIC5hdHRyKFwiZHlcIiwgXCIuMzVlbVwiKVxuICAgICAgICAudGV4dChmdW5jdGlvbihkKSB7cmV0dXJuIGQudGV4dDsgfSk7XG5cbiAgd2luZG93LmVhY2goZnVuY3Rpb24oZCkge1xuICAgICB2YXIgZmVhdHMgPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0QWxsKCcuZmVhdCcpLmRhdGEoZC5mZWF0dXJlcyk7XG5cbiAgICAgZmVhdHMuZW50ZXIoKS5hcHBlbmQoJ2cnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ2ZlYXQnKVxuICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuICd0cmFuc2xhdGUoJytkLnggKyAnLCcrIGQueSsnKSd9KVxuICAgICAgLmVhY2goZnVuY3Rpb24oZCkge1xuICAgICAgICB2YXIgcmVjdHMgPSBkMy5zZWxlY3QodGhpcykuc2VsZWN0QWxsKCdyZWN0JykuZGF0YShkLnJlY3RzKTtcblxuICAgICAgICByZWN0cy5lbnRlcigpLmFwcGVuZCgncmVjdCcpXG4gICAgICAgICAgLmF0dHIoJ3gnLCBmdW5jdGlvbihkKSB7cmV0dXJuIGQueDsgfSlcbiAgICAgICAgICAuYXR0cigneScsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC55OyB9KVxuICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC53OyB9KVxuICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCBmdW5jdGlvbihkKSB7cmV0dXJuIGQuaDsgfSlcbiAgICAgICAgICAuYXR0cignZmlsbCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC5jb2xvcn0pXG4gICAgICAgICAgLmF0dHIoJ3N0cm9rZScsICdibGFjaycpXG4gICAgICAgICAgLmF0dHIoJ3N0cm9rZS13aWR0aCcsICcycHgnKTtcbiAgICB9KTtcbiAgfSk7XG59O1xuXG5ucy5kZXN0cm95ID0gZnVuY3Rpb24oZWwpIHtcblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBucztcbiIsIi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG5cbnJlcXVpcmUoJy4vZDNMZWdlbmQubGVzcycpO1xucmVxdWlyZSgnLi9kM0Jhci5sZXNzJyk7XG5yZXF1aXJlKCcuL2QzQXhpcy5sZXNzJyk7XG5cbnZhciBucyA9IHt9O1xuXG5ucy5fbWFyZ2luID0ge3RvcDogNDAsIHJpZ2h0OiAyMCwgYm90dG9tOiAzMCwgbGVmdDogNjB9OyBcblxubnMuX3dpZHRoID0gZnVuY3Rpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLndpZHRoIC0gdGhpcy5fbWFyZ2luLmxlZnQgLSB0aGlzLl9tYXJnaW4ucmlnaHQ7XG59XG5cbm5zLl9oZWlnaHQgPSBmdW5jdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuaGVpZ2h0IC0gdGhpcy5fbWFyZ2luLnRvcCAtIHRoaXMuX21hcmdpbi5ib3R0b207XG59XG5cbm5zLmNyZWF0ZSA9IGZ1bmN0aW9uKGVsLCBwcm9wcywgc3RhdGUpIHtcblxuICBkMy5zZWxlY3QoZWwpLmFwcGVuZCgnc3ZnJylcbiAgICAuYXR0cignd2lkdGgnLCBwcm9wcy53aWR0aClcbiAgICAuYXR0cignaGVpZ2h0JywgcHJvcHMuaGVpZ2h0KVxuICAgIC5hcHBlbmQoJ2cnKVxuICAgIC5hdHRyKCdjbGFzcycsICdjaGFydCcpXG4gICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHRoaXMuX21hcmdpbi5sZWZ0ICsgJywnICsgdGhpcy5fbWFyZ2luLnRvcCArICcpJyk7XG5cbiAgdGhpcy51cGRhdGUoZWwsIHByb3BzKTtcbn1cblxubnMuX2NvbG9yID0gZnVuY3Rpb24oKSB7XG4gIHZhciBjb2xvciA9IGQzLnNjYWxlLm9yZGluYWwoKVxuICAgICAgICAgICAgICAvLyAucmFuZ2UoW1wiIzk4YWJjNVwiLCBcIiM4YTg5YTZcIiwgXCIjN2I2ODg4XCIsIFwiIzZiNDg2YlwiLCBcIiNhMDVkNTZcIiwgXCIjZDA3NDNjXCIsIFwiI2ZmOGMwMFwiXSk7XG4gICAgICAgICAgICAgIC5yYW5nZShbXCIjOThhYmM1XCIsIFwiIzdiNjg4OFwiLCBcIiM2YjQ4NmJcIiwgXCIjYTA1ZDU2XCIsIFwiI2QwNzQzY1wiLCBcIiNmZjhjMDBcIl0pO1xuICAgICAgICAgICAgICAvLyAucmFuZ2UoW1wiIzk4YWJjNVwiLCBcIiM3YjY4ODhcIiwgXCIjYTA1ZDU2XCIsIFwiI2QwNzQzY1wiLCBcIiNmZjhjMDBcIl0pO1xuICByZXR1cm4gY29sb3I7XG59XG5ucy5fYXhpcyA9IGZ1bmN0aW9uKHNjYWxlcykge1xuICB2YXIgeCA9IGQzLnN2Zy5heGlzKClcbiAgICAgICAgICAgICAgLnNjYWxlKHNjYWxlcy54MClcbiAgICAgICAgICAgICAgLm9yaWVudCgnYm90dG9tJyk7XG5cbiAgdmFyIHkgPSBkMy5zdmcuYXhpcygpXG4gICAgICAgICAgICAgIC5zY2FsZShzY2FsZXMueSlcbiAgICAgICAgICAgICAgLm9yaWVudCgnbGVmdCcpXG4gICAgICAgICAgICAgIC50aWNrVmFsdWVzKFsxZTAsIDFlMSwgMWUyLCAxZTMsIDFlNF0pXG4gICAgICAgICAgICAgIC50aWNrRm9ybWF0KGQzLmZvcm1hdCgnLnMnKSk7XG4gICAgICAgICAgICAgIC8vIC50aWNrRm9ybWF0KGQzLmZvcm1hdCgnLjJzJykpO1xuXG4gIHJldHVybiB7eDogeCwgeTogeX07XG59XG5cbm5zLl9zY2FsZXMgPSBmdW5jdGlvbihwcm9wcykge1xuICB3aWR0aCA9IHRoaXMuX3dpZHRoKHByb3BzKTtcbiAgaGVpZ2h0ID0gdGhpcy5faGVpZ2h0KHByb3BzKTtcblxuICB2YXIgeSA9IGQzLnNjYWxlLmxvZygpXG4gICAgICAgICAgLnJhbmdlKFtoZWlnaHQsIDBdKTtcblxuICB2YXIgeDAgPSBkMy5zY2FsZS5vcmRpbmFsKClcbiAgICAgICAgICAucmFuZ2VSb3VuZEJhbmRzKFswLCB3aWR0aF0sIC4xKTtcbiAgdmFyIHgxID0gZDMuc2NhbGUub3JkaW5hbCgpO1xuXG4gIHJldHVybiB7eDA6IHgwLCB4MTogeDEsIHk6IHl9O1xufVxuXG5ucy51cGRhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMpIHtcbiAgdmFyIHdpZHRoID0gdGhpcy5fd2lkdGgocHJvcHMpO1xuICB2YXIgaGVpZ2h0ID0gdGhpcy5faGVpZ2h0KHByb3BzKTtcbiAgdmFyIHNjYWxlcyA9IHRoaXMuX3NjYWxlcyhwcm9wcyk7XG4gIHZhciBheGlzID0gdGhpcy5fYXhpcyhzY2FsZXMpO1xuICB2YXIgY29sb3IgPSB0aGlzLl9jb2xvcigpO1xuXG4gIGQzLmNzdihwcm9wcy5jc3YsIGZ1bmN0aW9uIChlcnJvciwgZGF0YSkge1xuICAgIGlmIChlcnJvcikgdGhyb3cgZXJyO1xuXG4gICAgdmFyIGFnZU5hbWVzID0gZDMua2V5cyhkYXRhWzBdKS5maWx0ZXIoZnVuY3Rpb24oa2V5KSB7IHJldHVybiBrZXkgIT09ICdTdGF0ZSc7fSk7XG5cbiAgICBkYXRhLmZvckVhY2goZnVuY3Rpb24oZCkge1xuICAgICAgZC5hZ2VzID0gYWdlTmFtZXMubWFwKGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuIHtuYW1lOiBuYW1lLCB2YWx1ZTogK2RbbmFtZV19OyB9KTtcbiAgICB9KTtcbiAgICBcblxuICAgIHNjYWxlcy54MC5kb21haW4oZGF0YS5tYXAoZnVuY3Rpb24oZCkgeyByZXR1cm4gZC5TdGF0ZTsgfSkpO1xuICAgIHNjYWxlcy54MS5kb21haW4oYWdlTmFtZXMpLnJhbmdlUm91bmRCYW5kcyhbMCwgc2NhbGVzLngwLnJhbmdlQmFuZCgpXSk7XG4gICAgc2NhbGVzLnkuZG9tYWluKFtkMy5taW4oZGF0YSwgZnVuY3Rpb24oZCkgeyByZXR1cm4gZDMubWluKGQuYWdlcywgZnVuY3Rpb24oZCkge3JldHVybiBkLnZhbHVlOyB9KTsgfSksIGQzLm1heChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiBkMy5tYXgoZC5hZ2VzLCBmdW5jdGlvbihkKSB7cmV0dXJuIGQudmFsdWU7IH0pOyB9KV0pO1xuICAgIHNjYWxlcy55LmRvbWFpbihbMSwgZDMubWF4KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQzLm1heChkLmFnZXMsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC52YWx1ZTsgfSk7IH0pXSk7XG5cbiAgICB2YXIgY2hhcnQgPSBkMy5zZWxlY3QoZWwpLnNlbGVjdCgnLmNoYXJ0Jyk7XG5cbiAgICBjaGFydC5hcHBlbmQoJ2cnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ3ggYXhpcycpXG4gICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLCBcIiArIGhlaWdodCArIFwiKVwiKVxuICAgICAgLmNhbGwoYXhpcy54KTtcblxuICAgIGNoYXJ0LmFwcGVuZChcImdcIilcbiAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ5IGF4aXNcIilcbiAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgLSAzICsgXCIsMClcIilcbiAgICAgIC5jYWxsKGF4aXMueSlcbiAgICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICdyb3RhdGUoLTkwKScpXG4gICAgICAuYXR0cigneScsIDYpXG4gICAgICAuYXR0cignZHknLCAnLjcxZW0nKVxuICAgICAgLnN0eWxlKCd0ZXh0LWFuY2hvcicsICdlbmQnKVxuICAgICAgLnRleHQoJ21zIHBlciBmcmFtZScpO1xuXG5cbiAgICAvLyBkYXRhIGpvaW4gKGVudGVyIG9ubHkpXG4gICAgdmFyIHN0YXRlID0gY2hhcnQuc2VsZWN0QWxsKCcuc3RhdGUnKVxuICAgICAgICAgICAuZGF0YShkYXRhKVxuICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ2cnKVxuICAgICAgICAgICAuYXR0cignY2xhc3MnLCAnc3RhdGUnKVxuICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gXCJ0cmFuc2xhdGUoXCIgKyBzY2FsZXMueDAoZC5TdGF0ZSkgKyBcIiwgMClcIjsgfSk7XG5cbiAgICBzdGF0ZS5zZWxlY3RBbGwoJ3JlY3QnKVxuICAgICAgICAuZGF0YShmdW5jdGlvbihkKSB7cmV0dXJuIGQuYWdlczt9KVxuICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3JlY3QnKVxuICAgICAgICAuYXR0cihcIndpZHRoXCIsIHNjYWxlcy54MS5yYW5nZUJhbmQoKSlcbiAgICAgICAgLmF0dHIoXCJ4XCIsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIHNjYWxlcy54MShkLm5hbWUpOyB9KVxuICAgICAgICAuYXR0cihcInlcIiwgZnVuY3Rpb24oZCkgeyByZXR1cm4gc2NhbGVzLnkoZC52YWx1ZSk7IH0pXG4gICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGhlaWdodCAtIHNjYWxlcy55KGQudmFsdWUpOyB9KVxuICAgICAgICAuc3R5bGUoJ2ZpbGwnLCBmdW5jdGlvbihkKSB7IHJldHVybiBjb2xvcihkLm5hbWUpOyB9KTtcblxuICAgIC8vIHN0YXRlLnNlbGVjdEFsbCgndGV4dCcpXG4gICAgLy8gICAgIC5kYXRhKGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC5hZ2VzO30pXG4gICAgLy8gICAgIC5lbnRlcigpLmFwcGVuZCgndGV4dCcpXG4gICAgLy8gICAgIC5hdHRyKCdjbGFzcycsICdheGlzJylcbiAgICAvLyAgICAgLmF0dHIoXCJ4XCIsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIHNjYWxlcy54MShkLm5hbWUpICsgc2NhbGVzLngxLnJhbmdlQmFuZCgpLzI7IH0pXG4gICAgLy8gICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBzY2FsZXMueShkLnZhbHVlKTsgfSlcbiAgICAvLyAgICAgLmF0dHIoXCJkeVwiLCBcIi0uMzVlbVwiKVxuICAgIC8vICAgICAuc3R5bGUoXCJ0ZXh0LWFuY2hvclwiLCBcIm1pZGRsZVwiKVxuICAgIC8vICAgICAudGV4dChmdW5jdGlvbihkKSB7XG4gICAgLy8gICAgICAgICByZXR1cm4gZC52YWx1ZTtcbiAgICAvLyAgICAgfSk7XG5cbiAgICB2YXIgbGVnZW5kID0gY2hhcnQuc2VsZWN0QWxsKCcubGVnZW5kJylcbiAgICAgICAgLy8gLmRhdGEoY29sb3IuZG9tYWluKCkuc2xpY2UoKS5yZXZlcnNlKCkpXG4gICAgICAgIC5kYXRhKGNvbG9yLmRvbWFpbigpLnNsaWNlKCkpXG4gICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgIC5hdHRyKCdjbGFzcycsICdsZWdlbmQnKVxuICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCwgaSkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgwLCAnICsgaSAqIDIwICsgJyknOyB9KTtcblxuICAgICAgICB2YXIgbGVnZW5kX29mZnNldCA9IDIwO1xuICAgIGxlZ2VuZC5hcHBlbmQoJ3JlY3QnKVxuICAgICAgLmF0dHIoJ3gnLCBsZWdlbmRfb2Zmc2V0ICsgd2lkdGggLSAxOClcbiAgICAgIC5hdHRyKCd3aWR0aCcsIDE4KVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIDE4KVxuICAgICAgLnN0eWxlKCdmaWxsJywgY29sb3IpXG4gICAgbGVnZW5kLmFwcGVuZCgndGV4dCcpXG4gICAgICAgIC5hdHRyKFwieFwiLCBsZWdlbmRfb2Zmc2V0ICsgd2lkdGggLSAyNClcbiAgICAgICAgLmF0dHIoXCJ5XCIsIDkpXG4gICAgICAgIC5hdHRyKFwiZHlcIiwgXCIuMzVlbVwiKVxuICAgICAgICAuc3R5bGUoXCJ0ZXh0LWFuY2hvclwiLCBcImVuZFwiKVxuICAgICAgICAudGV4dChmdW5jdGlvbihkKSB7cmV0dXJuIGQ7IH0pO1xuICB9KTtcblxuICBmdW5jdGlvbiB0eXBlKGQpIHtcbiAgICBkLnZhbHVlID0gK2QudmFsdWU7IC8vY29lcmNlIHRvIG51bWJlclxuICAgIHJldHVybiBkO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkX3BlcmNlbnQoZCwgbikge1xuICAgIHBlcmNlbnQgPSArKGQuc3BsaXQoXCIlXCIpWzBdKVxuICAgIG5ld1BlcmNlbnQgPSBwZXJjZW50ICsgblxuICAgIHJldHVybiBcIlwiICsgbmV3UGVyY2VudCArIFwiJVwiO1xuICB9XG59O1xuXG5ucy5kZXN0cm95ID0gZnVuY3Rpb24oZWwpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5zO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5oYXhpcyB0ZXh0e2ZvbnQ6MTBweCBzYW5zLXNlcmlmICFpbXBvcnRhbnR9LmhheGlzIHBhdGgsLmhheGlzIGxpbmV7ZmlsbDpub25lO3N0cm9rZTojMDAwO3NoYXBlLXJlbmRlcmluZzpjcmlzcEVkZ2VzfS55LmhheGlzIHBhdGh7ZGlzcGxheTpub25lfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwiLy8gdmFyIGQzID0gcmVxdWlyZSgnZDMnKTtcblxucmVxdWlyZSgnLi9kM0hCYXIubGVzcycpO1xucmVxdWlyZSgnLi9kM0hBeGlzLmxlc3MnKTtcblxudmFyIG5zID0ge307XG5cbm5zLl9tYXJnaW4gPSB7dG9wOiAyMCwgcmlnaHQ6IDMwLCBib3R0b206IDMwLCBsZWZ0OiA0MH07IFxuXG5ucy5fd2lkdGggPSBmdW5jdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMud2lkdGggLSB0aGlzLl9tYXJnaW4ubGVmdCAtIHRoaXMuX21hcmdpbi5yaWdodDtcbn1cblxubnMuX2hlaWdodCA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5oZWlnaHQgLSB0aGlzLl9tYXJnaW4udG9wIC0gdGhpcy5fbWFyZ2luLmJvdHRvbTtcbn1cblxubnMuY3JlYXRlID0gZnVuY3Rpb24oZWwsIHByb3BzLCBzdGF0ZSkge1xuICBkMy5zZWxlY3QoZWwpLmFwcGVuZCgnc3ZnJylcbiAgICAgIC5hdHRyKCd3aWR0aCcsIHByb3BzLndpZHRoKVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIHByb3BzLndpZHRoKVxuICAgICAgLmFwcGVuZCgnZycpXG4gICAgICAuYXR0cignY2xhc3MnLCAnY2hhcnQnKVxuICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHRoaXMuX21hcmdpbi5sZWZ0ICsgJywnICsgdGhpcy5fbWFyZ2luLnRvcCArICcpJyk7XG5cbiAgdGhpcy51cGRhdGUoZWwsIHByb3BzKTtcbn1cblxubnMuX2F4aXMgPSBmdW5jdGlvbihzY2FsZXMpIHtcbiAgdmFyIHggPSBkMy5zdmcuYXhpcygpXG4gICAgICAgICAgICAgIC5zY2FsZShzY2FsZXMueClcbiAgICAgICAgICAgICAgLm9yaWVudCgnYm90dG9tJylcbiAgICAgICAgICAgICAgLnRpY2tzKDEwLCAnJScpO1xuXG4gIHZhciB5ID0gZDMuc3ZnLmF4aXMoKVxuICAgICAgICAgICAgICAuc2NhbGUoc2NhbGVzLnkpXG4gICAgICAgICAgICAgIC5vcmllbnQoJ2xlZnQnKTtcblxuICByZXR1cm4ge3g6IHgsIHk6IHl9O1xufVxuXG5ucy5fc2NhbGVzID0gZnVuY3Rpb24ocHJvcHMpIHtcbiAgd2lkdGggPSB0aGlzLl93aWR0aChwcm9wcyk7XG4gIGhlaWdodCA9IHRoaXMuX2hlaWdodChwcm9wcyk7XG5cbiAgdmFyIHggPSBkMy5zY2FsZS5saW5lYXIoKVxuICAgICAgICAgIC5yYW5nZShbMCwgd2lkdGhdKTtcbiAgdmFyIHkgPSBkMy5zY2FsZS5vcmRpbmFsKClcbiAgICAgICAgICAucmFuZ2VSb3VuZEJhbmRzKFswLCBoZWlnaHRdLCAuMSk7XG5cbiAgcmV0dXJuIHt4OiB4LCB5OiB5fTtcbn1cblxubnMudXBkYXRlID0gZnVuY3Rpb24oZWwsIHByb3BzKSB7XG4gIHZhciB3aWR0aCA9IHRoaXMuX3dpZHRoKHByb3BzKTtcbiAgdmFyIGhlaWdodCA9IHRoaXMuX2hlaWdodChwcm9wcyk7XG4gIHZhciBzY2FsZXMgPSB0aGlzLl9zY2FsZXMocHJvcHMpO1xuICB2YXIgYXhpcyA9IHRoaXMuX2F4aXMoc2NhbGVzKTtcblxuICBkMy5jc3YocHJvcHMuY3N2LCB0eXBlLCBmdW5jdGlvbiAoZXJyb3IsIGRhdGEpIHtcbiAgICBzY2FsZXMueC5kb21haW4oWzAsIGQzLm1heChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLnZhbHVlOyB9KV0pO1xuICAgIHNjYWxlcy55LmRvbWFpbihkYXRhLm1hcChmdW5jdGlvbihkKSB7cmV0dXJuIGQubmFtZTsgfSkpO1xuXG4gICAgdmFyIGNoYXJ0ID0gZDMuc2VsZWN0KGVsKS5zZWxlY3QoJy5jaGFydCcpO1xuXG4gICAgY2hhcnQuYXBwZW5kKCdnJylcbiAgICAgIC5hdHRyKCdjbGFzcycsICd4IGhheGlzJylcbiAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKDAsIFwiICsgaGVpZ2h0ICsgXCIpXCIpXG4gICAgICAuY2FsbChheGlzLngpXG4gICAgICAuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCd5JywgNilcbiAgICAgIC5hdHRyKCdkeScsICcuMzVlbScpXG4gICAgICAuc3R5bGUoJ3RleHQtYW5jaG9yJywgJ21pZGRsZScpXG4gICAgICAudGV4dCgnRnJlcXVlbmN5Jyk7XG5cbiAgICBjaGFydC5hcHBlbmQoXCJnXCIpXG4gICAgICAuYXR0cihcImNsYXNzXCIsIFwieSBoYXhpc1wiKVxuICAgICAgLmNhbGwoYXhpcy55KTtcblxuICAgIC8vIGRhdGEgam9pbiAoZW50ZXIgb25seSlcbiAgICB2YXIgYmFyID0gY2hhcnQuc2VsZWN0QWxsKCcuaGJhcicpXG4gICAgICAgICAgIC5kYXRhKGRhdGEpXG4gICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgIC5hdHRyKCdjbGFzcycsICdoYmFyJylcbiAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIFwidHJhbnNsYXRlKDAsXCIgKyBzY2FsZXMueShkLm5hbWUpICsgXCIpXCI7IH0pO1xuXG4gICAgYmFyLmFwcGVuZCgncmVjdCcpXG4gICAgICAgIC5hdHRyKFwid2lkdGhcIiwgZnVuY3Rpb24oZCkgeyByZXR1cm4gc2NhbGVzLngoZC52YWx1ZSk7IH0pXG4gICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIHNjYWxlcy55LnJhbmdlQmFuZCgpKTtcblxuICAgIGJhci5hcHBlbmQoJ3RleHQnKVxuICAgICAgICAuYXR0cihcInhcIiwgZnVuY3Rpb24oZCkgeyByZXR1cm4gc2NhbGVzLngoZC52YWx1ZSkgLSAzOyB9KVxuICAgICAgICAuYXR0cihcInlcIiwgc2NhbGVzLnkucmFuZ2VCYW5kKCkgLyAyKVxuICAgICAgICAuYXR0cihcImR5XCIsIFwiLjM1ZW1cIilcbiAgICAgICAgLnRleHQoZnVuY3Rpb24oZCkge3JldHVybiBNYXRoLnJvdW5kKGQudmFsdWUgKiAxMDAwKS8xMC4wO30pO1xuICB9KTtcblxuICBmdW5jdGlvbiB0eXBlKGQpIHtcbiAgICBkLnZhbHVlID0gK2QudmFsdWU7IC8vY29lcmNlIHRvIG51bWJlclxuICAgIHJldHVybiBkO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkX3BlcmNlbnQoZCwgbikge1xuICAgIHBlcmNlbnQgPSArKGQuc3BsaXQoXCIlXCIpWzBdKVxuICAgIG5ld1BlcmNlbnQgPSBwZXJjZW50ICsgblxuICAgIHJldHVybiBcIlwiICsgbmV3UGVyY2VudCArIFwiJVwiO1xuICB9XG59O1xuXG5ucy5kZXN0cm95ID0gZnVuY3Rpb24oZWwpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5zO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5oYmFyIHJlY3R7ZmlsbDpzdGVlbGJsdWV9LmhiYXI6aG92ZXIgcmVjdHtmaWxsOnJlZCAhaW1wb3J0YW50fS5oYmFyIHRleHR7dmlzaWJpbGl0eTpoaWRkZW4gIWltcG9ydGFudDtmaWxsOndoaXRlICFpbXBvcnRhbnQ7Zm9udDoxMHB4IHNhbnMtc2VyaWYgIWltcG9ydGFudDt0ZXh0LWFuY2hvcjplbmQgIWltcG9ydGFudH0uaGJhcjpob3ZlciB0ZXh0e3Zpc2liaWxpdHk6dmlzaWJsZSAhaW1wb3J0YW50fVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwiLy8gdmFyIGQzID0gcmVxdWlyZSgnZDMnKTtcblxucmVxdWlyZSgnLi9kM0Jhci5sZXNzJyk7XG5yZXF1aXJlKCcuL2QzVGlsZS5sZXNzJyk7XG5yZXF1aXJlKCcuL2QzQXhpcy5sZXNzJyk7XG5cbnZhciBucyA9IHt9O1xuXG5ucy5fbWFyZ2luID0ge3RvcDogMjAsIHJpZ2h0OiA5MCwgYm90dG9tOiAzMCwgbGVmdDogNTB9OyBcblxubnMuX3dpZHRoID0gZnVuY3Rpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLndpZHRoIC0gdGhpcy5fbWFyZ2luLmxlZnQgLSB0aGlzLl9tYXJnaW4ucmlnaHQ7XG59XG5cbm5zLl9oZWlnaHQgPSBmdW5jdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMuaGVpZ2h0IC0gdGhpcy5fbWFyZ2luLnRvcCAtIHRoaXMuX21hcmdpbi5ib3R0b207XG59XG5cbm5zLmNyZWF0ZSA9IGZ1bmN0aW9uKGVsLCBwcm9wcywgc3RhdGUpIHtcblxuICBkMy5zZWxlY3QoZWwpLmFwcGVuZCgnc3ZnJylcbiAgICAuYXR0cignd2lkdGgnLCBwcm9wcy53aWR0aClcbiAgICAuYXR0cignaGVpZ2h0JywgcHJvcHMuaGVpZ2h0KVxuICAgIC5hcHBlbmQoJ2cnKVxuICAgIC5hdHRyKCdjbGFzcycsICdjaGFydCcpXG4gICAgLmF0dHIoJ3RyYW5zZm9ybScsICd0cmFuc2xhdGUoJyArIHRoaXMuX21hcmdpbi5sZWZ0ICsgJywnICsgdGhpcy5fbWFyZ2luLnRvcCArICcpJyk7XG5cbiAgdGhpcy51cGRhdGUoZWwsIHByb3BzKTtcbn1cblxubnMuX2F4aXMgPSBmdW5jdGlvbihzY2FsZXMpIHtcbiAgdmFyIGZvcm1hdERhdGUgPSBkMy50aW1lLmZvcm1hdChcIiViICVkXCIpO1xuICB2YXIgeCA9IGQzLnN2Zy5heGlzKClcbiAgICAgICAgICAgICAgLnNjYWxlKHNjYWxlcy54KVxuICAgICAgICAgICAgICAub3JpZW50KCdib3R0b20nKVxuICAgICAgICAgICAgICAudGlja3MoZDMudGltZS5kYXlzKVxuICAgICAgICAgICAgICAudGlja0Zvcm1hdChmb3JtYXREYXRlKTtcblxuICB2YXIgeSA9IGQzLnN2Zy5heGlzKClcbiAgICAgICAgICAgICAgLnNjYWxlKHNjYWxlcy55KVxuICAgICAgICAgICAgICAub3JpZW50KCdsZWZ0Jyk7XG5cbiAgcmV0dXJuIHt4OiB4LCB5OiB5fTtcbn1cblxubnMuX3NjYWxlcyA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHdpZHRoID0gdGhpcy5fd2lkdGgocHJvcHMpO1xuICBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuXG4gIHZhciB6ID0gZDMuc2NhbGUubGluZWFyKClcbiAgICAgICAgICAucmFuZ2UoW1wid2hpdGVcIiwgXCJzdGVlbGJsdWVcIl0pO1xuICB2YXIgeSA9IGQzLnNjYWxlLmxpbmVhcigpXG4gICAgICAgICAgLnJhbmdlKFtoZWlnaHQsIDBdKTtcbiAgdmFyIHggPSBkMy50aW1lLnNjYWxlKClcbiAgICAgICAgICAucmFuZ2UoWzAsIHdpZHRoXSk7XG5cbiAgcmV0dXJuIHt4OiB4LCB5OiB5LCB6OiB6fTtcbn1cblxubnMudXBkYXRlID0gZnVuY3Rpb24oZWwsIHByb3BzKSB7XG4gIHZhciB3aWR0aCA9IHRoaXMuX3dpZHRoKHByb3BzKTtcbiAgdmFyIGhlaWdodCA9IHRoaXMuX2hlaWdodChwcm9wcyk7XG4gIHZhciBzY2FsZXMgPSB0aGlzLl9zY2FsZXMocHJvcHMpO1xuICB2YXIgYXhpcyA9IHRoaXMuX2F4aXMoc2NhbGVzKTtcbiAgdmFyIHBhcnNlRGF0ZSA9IGQzLnRpbWUuZm9ybWF0KFwiJVktJW0tJWRcIikucGFyc2U7XG4gIHZhciB4U3RlcCA9IDg2NGU1LFxuICAgICAgeVN0ZXAgPSAxMDA7XG5cbiAgZDMuY3N2KHByb3BzLmNzdiwgdHlwZSwgZnVuY3Rpb24gKGVycm9yLCBkYXRhKSB7XG4gICAgaWYgKGVycm9yKSB0aHJvdyBlcnJvcjtcblxuICAgIHNjYWxlcy54LmRvbWFpbihkMy5leHRlbnQoZGF0YSwgZnVuY3Rpb24oZCkge3JldHVybiBkLmRhdGU7IH0pKTtcbiAgICBzY2FsZXMueS5kb21haW4oZDMuZXh0ZW50KGRhdGEsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC5idWNrZXQ7IH0pKTtcbiAgICBzY2FsZXMuei5kb21haW4oWzAsIGQzLm1heChkYXRhLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLmNvdW50OyB9KV0pO1xuXG4gICAgc2NhbGVzLnguZG9tYWluKFtzY2FsZXMueC5kb21haW4oKVswXSwgK3NjYWxlcy54LmRvbWFpbigpWzFdICsgeFN0ZXBdKTtcbiAgICBzY2FsZXMueS5kb21haW4oW3NjYWxlcy55LmRvbWFpbigpWzBdLCArc2NhbGVzLnkuZG9tYWluKClbMV0gKyB5U3RlcF0pO1xuXG4gICAgdmFyIGNoYXJ0ID0gZDMuc2VsZWN0KGVsKS5zZWxlY3QoJy5jaGFydCcpO1xuXG5cblxuICAgIC8vIGRhdGEgam9pbiAoZW50ZXIgb25seSlcbiAgICB2YXIgdGlsZSA9IGNoYXJ0LnNlbGVjdEFsbCgnLnRpbGUnKVxuICAgICAgICAgICAuZGF0YShkYXRhKVxuICAgICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3JlY3QnKVxuICAgICAgICAgICAuYXR0cignY2xhc3MnLCAndGlsZScpXG4gICAgICAgICAgIC5hdHRyKFwieFwiLCBmdW5jdGlvbihkKSB7IHJldHVybiBzY2FsZXMueChkLmRhdGUpOyB9KVxuICAgICAgICAgICAuYXR0cihcInlcIiwgZnVuY3Rpb24oZCkgeyByZXR1cm4gc2NhbGVzLnkoZC5idWNrZXQgKyB5U3RlcCk7IH0pXG4gICAgICAgICAgIC5hdHRyKFwid2lkdGhcIiwgc2NhbGVzLngoeFN0ZXApIC0gc2NhbGVzLngoMCkpXG4gICAgICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIHNjYWxlcy55KDApIC0gc2NhbGVzLnkoeVN0ZXApIClcbiAgICAgICAgICAgLnN0eWxlKCdmaWxsJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gc2NhbGVzLnooZC5jb3VudCk7IH0pO1xuXG4gICAgdmFyIGxlZ2VuZCA9IGNoYXJ0LnNlbGVjdEFsbCgnLmxlZ2VuZCcpXG4gICAgICAgICAgLmRhdGEoc2NhbGVzLnoudGlja3MoNikuc2xpY2UoMSkucmV2ZXJzZSgpKVxuICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ2xlZ2VuZCcpXG4gICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQsIGkpIHtyZXR1cm4gJ3RyYW5zbGF0ZSgnICsgKHdpZHRoICsyMCkgKyAnLCcgKyAoMjAgKyBpICoyMCkgKyAnKSc7fSk7XG5cbiAgICBsZWdlbmQuYXBwZW5kKFwicmVjdFwiKVxuICAgICAgLmF0dHIoXCJ3aWR0aFwiLCAyMClcbiAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIDIwKVxuICAgICAgLnN0eWxlKFwiZmlsbFwiLCBzY2FsZXMueik7XG5cbiAgICBsZWdlbmQuYXBwZW5kKFwidGV4dFwiKVxuICAgICAgLmF0dHIoXCJ4XCIsIDI2KVxuICAgICAgLmF0dHIoXCJ5XCIsIDEwKVxuICAgICAgLmF0dHIoXCJkeVwiLCBcIi4zNWVtXCIpXG4gICAgICAudGV4dChTdHJpbmcpO1xuXG4gICAgY2hhcnQuYXBwZW5kKCdnJylcbiAgICAgIC5hdHRyKCdjbGFzcycsICd4IGF4aXMnKVxuICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwgXCIgKyBoZWlnaHQgKyBcIilcIilcbiAgICAgIC5jYWxsKGF4aXMueCk7XG5cbiAgICBjaGFydC5hcHBlbmQoXCJnXCIpXG4gICAgICAuYXR0cihcImNsYXNzXCIsIFwieSBheGlzXCIpXG4gICAgICAuY2FsbChheGlzLnkpXG4gICAgICAuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAncm90YXRlKC05MCknKVxuICAgICAgLmF0dHIoJ3knLCA2KVxuICAgICAgLmF0dHIoJ2R5JywgJy43MWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnZW5kJylcbiAgICAgIC50ZXh0KCdWYWx1ZScpO1xuXG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHR5cGUoZCkge1xuICAgIGQuZGF0ZSA9IHBhcnNlRGF0ZShkLmRhdGUpO1xuICAgIGQuYnVja2V0ID0gK2QuYnVja2V0O1xuICAgIGQuY291bnQgPSArZC5jb3VudDsgLy9jb2VyY2UgdG8gbnVtYmVyXG4gICAgcmV0dXJuIGQ7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRfcGVyY2VudChkLCBuKSB7XG4gICAgcGVyY2VudCA9ICsoZC5zcGxpdChcIiVcIilbMF0pXG4gICAgbmV3UGVyY2VudCA9IHBlcmNlbnQgKyBuXG4gICAgcmV0dXJuIFwiXCIgKyBuZXdQZXJjZW50ICsgXCIlXCI7XG4gIH1cbn07XG5cbm5zLmRlc3Ryb3kgPSBmdW5jdGlvbihlbCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gbnM7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLmxlZ2VuZCB0ZXh0e2ZvbnQ6MTBweCBzYW5zLXNlcmlmICFpbXBvcnRhbnR9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCIvLyB2YXIgZDMgPSByZXF1aXJlKCdkMycpO1xuXG5yZXF1aXJlKCcuL2QzTGV0dGVycy5sZXNzJyk7XG5cbnZhciBucyA9IHt9O1xuXG5ucy5jcmVhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMsIHN0YXRlKSB7XG4gIHZhciBzdmcgPSBkMy5zZWxlY3QoZWwpLmFwcGVuZCgnc3ZnJylcbiAgICAgIC5hdHRyKCd3aWR0aCcsIHByb3BzLndpZHRoKVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIHByb3BzLmhlaWdodCk7XG5cbiAgdGhpcy51cGRhdGUoZWwsIHN0YXRlKTtcbn07XG5cbm5zLnVwZGF0ZSA9IGZ1bmN0aW9uKGVsLCBzdGF0ZSkge1xuICAvLyBkYXRhIGpvaW5cbiAgdmFyIHRleHQgPSBkMy5zZWxlY3QoZWwpLnNlbGVjdEFsbCgndGV4dCcpXG4gICAgICAgICAuZGF0YShzdGF0ZS5kYXRhKTtcblxuICAvLyB1cGRhdGVcbiAgdGV4dC5hdHRyKCdjbGFzcycsICd1cGRhdGUnKTtcblxuICAvLyBlbnRlclxuICB0ZXh0LmVudGVyKCkuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCdjbGFzcycsICdlbnRlcicpXG4gICAgICAuYXR0cigneCcsIGZ1bmN0aW9uKGQsIGkpIHsgcmV0dXJuIGkgKiAzMjsgfSlcbiAgICAgIC5hdHRyKCdkeScsICcuMzVlbScpO1xuXG4gIC8vIGVudGVyICsgdXBkYXRlXG4gIHRleHQudGV4dChmdW5jdGlvbihkKSB7cmV0dXJuIGQ7IH0pO1xuXG4gIC8vIGV4aXRcbiAgdGV4dC5leGl0KCkucmVtb3ZlKCk7XG59O1xuXG5ucy5kZXN0cm95ID0gZnVuY3Rpb24oZWwpIHtcblxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBucztcbiIsIihmdW5jdGlvbigpIHsgdmFyIGhlYWQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnaGVhZCcpWzBdOyB2YXIgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpOyBzdHlsZS50eXBlID0gJ3RleHQvY3NzJzt2YXIgY3NzID0gXCJ0ZXh0e2ZvbnQ6Ym9sZCA0OHB4IG1vbm9zcGFjZX0uZW50ZXJ7Y29sb3I6IzFhYmM5Y31cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG5cbnJlcXVpcmUoJy4vZDNMaW5lLmxlc3MnKTtcbnJlcXVpcmUoJy4vZDNBeGlzLmxlc3MnKTtcblxudmFyIG5zID0ge307XG5cbm5zLl9tYXJnaW4gPSB7dG9wOiAyMCwgcmlnaHQ6IDMwLCBib3R0b206IDMwLCBsZWZ0OiA0MH07IFxuXG5ucy5fd2lkdGggPSBmdW5jdGlvbihwcm9wcykge1xuICByZXR1cm4gcHJvcHMud2lkdGggLSB0aGlzLl9tYXJnaW4ubGVmdCAtIHRoaXMuX21hcmdpbi5yaWdodDtcbn1cblxubnMuX2hlaWdodCA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy5oZWlnaHQgLSB0aGlzLl9tYXJnaW4udG9wIC0gdGhpcy5fbWFyZ2luLmJvdHRvbTtcbn1cblxubnMuY3JlYXRlID0gZnVuY3Rpb24oZWwsIHByb3BzLCBzdGF0ZSkge1xuXG4gIGQzLnNlbGVjdChlbCkuYXBwZW5kKCdzdmcnKVxuICAgIC5hdHRyKCd3aWR0aCcsIHByb3BzLndpZHRoKVxuICAgIC5hdHRyKCdoZWlnaHQnLCBwcm9wcy5oZWlnaHQpXG4gICAgLmFwcGVuZCgnZycpXG4gICAgLmF0dHIoJ2NsYXNzJywgJ2NoYXJ0JylcbiAgICAuYXR0cigndHJhbnNmb3JtJywgJ3RyYW5zbGF0ZSgnICsgdGhpcy5fbWFyZ2luLmxlZnQgKyAnLCcgKyB0aGlzLl9tYXJnaW4udG9wICsgJyknKTtcblxuICB0aGlzLnVwZGF0ZShlbCwgcHJvcHMpO1xufVxuXG5ucy5fYXhpcyA9IGZ1bmN0aW9uKHNjYWxlcykge1xuICB2YXIgeCA9IGQzLnN2Zy5heGlzKClcbiAgICAgICAgICAgICAgLnNjYWxlKHNjYWxlcy54KVxuICAgICAgICAgICAgICAub3JpZW50KCdib3R0b20nKTtcblxuICB2YXIgeSA9IGQzLnN2Zy5heGlzKClcbiAgICAgICAgICAgICAgLnNjYWxlKHNjYWxlcy55KVxuICAgICAgICAgICAgICAub3JpZW50KCdsZWZ0Jyk7XG5cbiAgcmV0dXJuIHt4OiB4LCB5OiB5fTtcbn1cblxubnMuX3NjYWxlcyA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHdpZHRoID0gdGhpcy5fd2lkdGgocHJvcHMpO1xuICBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuXG4gIHZhciB5ID0gZDMuc2NhbGUubGluZWFyKClcbiAgICAgICAgICAucmFuZ2UoW2hlaWdodCwgMF0pO1xuXG4gIHZhciB4ID0gZDMudGltZS5zY2FsZSgpXG4gICAgICAgICAgLnJhbmdlKFswLCB3aWR0aF0pO1xuXG4gIHJldHVybiB7eDogeCwgeTogeX07XG59XG5cbm5zLnVwZGF0ZSA9IGZ1bmN0aW9uKGVsLCBwcm9wcykge1xuICB2YXIgd2lkdGggPSB0aGlzLl93aWR0aChwcm9wcyk7XG4gIHZhciBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuICB2YXIgc2NhbGVzID0gdGhpcy5fc2NhbGVzKHByb3BzKTtcbiAgdmFyIGF4aXMgPSB0aGlzLl9heGlzKHNjYWxlcyk7XG5cbiAgdmFyIHBhcnNlRGF0ZSA9IGQzLnRpbWUuZm9ybWF0KFwiJWQtJWItJXlcIikucGFyc2U7XG4gIHZhciBsaW5lID0gZDMuc3ZnLmxpbmUoKVxuICAgICAgICAgICAgICAgLngoZnVuY3Rpb24oZCkge3JldHVybiBzY2FsZXMueChkLmRhdGUpOyB9KVxuICAgICAgICAgICAgICAgLnkoZnVuY3Rpb24oZCkge3JldHVybiBzY2FsZXMueShkLmNsb3NlKTsgfSk7XG5cblxuICBkMy5jc3YocHJvcHMuY3N2LCB0eXBlLCBmdW5jdGlvbiAoZXJyb3IsIGRhdGEpIHtcbiAgICBpZiAoZXJyb3IpIHRocm93IGVycjtcblxuICAgIHNjYWxlcy54LmRvbWFpbihkMy5leHRlbnQoZGF0YSwgZnVuY3Rpb24oZCkge3JldHVybiBkLmRhdGU7IH0pKTtcbiAgICBzY2FsZXMueS5kb21haW4oZDMuZXh0ZW50KGRhdGEsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC5jbG9zZTsgfSkpO1xuXG4gICAgdmFyIGNoYXJ0ID0gZDMuc2VsZWN0KGVsKS5zZWxlY3QoJy5jaGFydCcpO1xuXG4gICAgY2hhcnQuYXBwZW5kKCdnJylcbiAgICAgIC5hdHRyKCdjbGFzcycsICd4IGF4aXMnKVxuICAgICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoMCwgXCIgKyBoZWlnaHQgKyBcIilcIilcbiAgICAgIC5jYWxsKGF4aXMueCk7XG5cbiAgICBjaGFydC5hcHBlbmQoXCJnXCIpXG4gICAgICAuYXR0cihcImNsYXNzXCIsIFwieSBheGlzXCIpXG4gICAgICAuY2FsbChheGlzLnkpXG4gICAgICAuYXBwZW5kKCd0ZXh0JylcbiAgICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAncm90YXRlKC05MCknKVxuICAgICAgLmF0dHIoJ3knLCA2KVxuICAgICAgLmF0dHIoJ2R5JywgJy43MWVtJylcbiAgICAgIC5zdHlsZSgndGV4dC1hbmNob3InLCAnZW5kJylcbiAgICAgIC50ZXh0KCdQcm9maXQgKCQpJyk7XG5cbiAgICAgIC8vIGRhdGEgam9pbiAoZW50ZXIgb25seSlcbiAgICAgIGNoYXJ0LmFwcGVuZCgncGF0aCcpXG4gICAgICAgIC5kYXR1bShkYXRhKVxuICAgICAgICAuYXR0cignY2xhc3MnLCAnbGluZScpXG4gICAgICAgIC5hdHRyKCdkJywgbGluZSk7XG5cblxuICB9KTtcblxuICBmdW5jdGlvbiB0eXBlKGQpIHtcbiAgICBkLmRhdGUgPSBwYXJzZURhdGUoZC5kYXRlKTtcbiAgICBkLmNsb3NlID0gK2QuY2xvc2U7IC8vY29lcmNlIHRvIG51bWJlclxuICAgIHJldHVybiBkO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkX3BlcmNlbnQoZCwgbikge1xuICAgIHBlcmNlbnQgPSArKGQuc3BsaXQoXCIlXCIpWzBdKVxuICAgIG5ld1BlcmNlbnQgPSBwZXJjZW50ICsgblxuICAgIHJldHVybiBcIlwiICsgbmV3UGVyY2VudCArIFwiJVwiO1xuICB9XG59O1xuXG5ucy5kZXN0cm95ID0gZnVuY3Rpb24oZWwpIHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5zO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5saW5le2ZpbGw6bm9uZTtzdHJva2U6c3RlZWxibHVlO3N0cm9rZS13aWR0aDoxLjVweH1cIjtpZiAoc3R5bGUuc3R5bGVTaGVldCl7IHN0eWxlLnN0eWxlU2hlZXQuY3NzVGV4dCA9IGNzczsgfSBlbHNlIHsgc3R5bGUuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY3NzKSk7IH0gaGVhZC5hcHBlbmRDaGlsZChzdHlsZSk7fSgpKSIsIi8vIHZhciBkMyA9IHJlcXVpcmUoJ2QzJyk7XG5cbi8vIHJlcXVpcmUoJy4vZDNGZWF0dXJlLmxlc3MnKTtcbnJlcXVpcmUoJy4vZDNBeGlzLmxlc3MnKTtcblxudmFyIG5zID0ge307XG5cbm5zLl93aWR0aCA9IGZ1bmN0aW9uKHByb3BzKSB7IHJldHVybiBwcm9wcy53aWR0aDsgfTtcbm5zLl9oZWlnaHQgPSBmdW5jdGlvbihwcm9wcykgeyByZXR1cm4gcHJvcHMuaGVpZ2h0OyB9O1xuXG5ucy5jcmVhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMsIHN0YXRlKSB7XG5cbiAgdmFyIHN2ZyA9IGQzLnNlbGVjdChlbCkuYXBwZW5kKCdzdmcnKVxuICAgICAgLmF0dHIoJ3dpZHRoJywgcHJvcHMud2lkdGgpXG4gICAgICAuYXR0cignaGVpZ2h0JywgcHJvcHMuaGVpZ2h0KTtcblxuICB0aGlzLnVwZGF0ZShlbCwgcHJvcHMpO1xufTtcblxubnMudXBkYXRlID0gZnVuY3Rpb24oZWwsIHByb3BzKSB7XG4gIHdpZHRoID0gdGhpcy5fd2lkdGgocHJvcHMpO1xuICBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuXG4gIC8vIHZhciByZWN0MCA9IHt4OiAwLCB5OiAwLCB3OiAzMCwgaDogMzAsIGNvbG9yOiBcIndoaXRlXCJ9O1xuICAvLyB2YXIgcmVjdDEgPSB7eDogMTUsIHk6IDE1LCB3OiAxNSwgaDogMTUsIGNvbG9yOiBcImJsYWNrXCJ9O1xuICAvLyB2YXIgcmVjdDIgPSB7eDogMCwgeTogMCwgdzogMTUsIGg6IDE1LCBjb2xvcjogXCJibGFja1wifTtcblxuICAvLyB2YXIgcmVjdDMgPSB7eDogMCwgeTogMCwgdzogNDAsIGg6IDMwLCBjb2xvcjogXCJ3aGl0ZVwifTtcbiAgLy8gdmFyIHJlY3Q0ID0ge3g6IDEwLCB5OiAwLCB3OiAyMCwgaDogMzAsIGNvbG9yOiBcImJsYWNrXCJ9O1xuXG4gIC8vIHZhciByZWN0NSA9IHt4OiAwLCB5OiAwLCB3OiA0MCwgaDogNDAsIGNvbG9yOiBcIndoaXRlXCJ9O1xuICAvLyB2YXIgcmVjdDYgPSB7eDogMCwgeTogMjAsIHc6IDQwLCBoOiAyMCwgY29sb3I6IFwiYmxhY2tcIn07XG5cbiAgLy8gdmFyIGZlYXQwID0ge3g6IDEwLCB5OiAyMCwgcmVjdHM6IFtyZWN0MCwgcmVjdDEsIHJlY3QyXX07XG4gIC8vIHZhciBmZWF0MSA9IHt4OiAyMCwgeTogNjAsIHJlY3RzOiBbcmVjdDMsIHJlY3Q0XX07XG4gIC8vIHZhciBmZWF0MiA9IHt4OiA1MCwgeTogMTAsIHJlY3RzOiBbcmVjdDUsIHJlY3Q2XX07XG5cbiAgLy8gdmFyIGZlYXR1cmVzMSA9IFtmZWF0MCwgZmVhdDEsIGZlYXQyXTtcbiAgLy8gdmFyIHdpbmRvdzEgPSB7eDogNDAsIHk6IDQwLCB3OiAxMDAsIGg6IDEwMCwgY29sb3I6IFwid2hpdGVcIiwgZmVhdHVyZXM6IGZlYXR1cmVzMSwgdGV4dDogXCJhKSBleGFtcGxlIEhhYXIgZmVhdHVyZXNcIn07XG5cblxuICB2YXIgbGJwID0gZnVuY3Rpb24odywgaCkge1xuICAgIHcgKj0gMTBcbiAgICBoICo9IDEwXG4gICAgdmFyIGFyciA9IFtdO1xuICAgIGZvciAodmFyIGogPSAwOyBqIDwgMzsgaisrICkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAzOyBpKysgKSB7XG4gICAgICAgIGFyci5wdXNoKHt4OiB3KmksIHk6IGgqaiwgdzogdywgaDogaCwgY29sb3I6IFwid2hpdGVcIn0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGFycls0XS5jb2xvciA9IFwiYmxhY2tcIjtcbiAgICByZXR1cm4gYXJyO1xuICB9XG5cbiAgdmFyIGZlYXQzID0ge3g6IDAsIHk6IDgqMis5MCwgcmVjdHM6IGxicCg0LCA0KX07XG4gIHZhciBmZWF0NCA9IHt4OiAwLCB5OiA4KjErMzAsIHJlY3RzOiBsYnAoMiwgMil9O1xuICB2YXIgZmVhdDUgPSB7eDogMCwgeTogMCwgcmVjdHM6IGxicCgxLCAxKX07XG4gIHZhciBmZWF0dXJlczEgPSBbZmVhdDMsIGZlYXQ0LCBmZWF0NV07XG4gIHZhciB3aW5kb3cyID0ge3g6IDAsIHk6IDAsIHc6IDIwMCwgaDogMzAwLCBjb2xvcjogXCJ3aGl0ZVwiLCBmZWF0dXJlczogZmVhdHVyZXMxLCB0ZXh0OiBcImIpIGV4YW1wbGUgTEJQIGZlYXR1cmVzXCJ9O1xuXG4gIC8vIHdpbmRvd3MgPSBbd2luZG93MSwgd2luZG93Ml07XG4gIHdpbmRvd3MgPSBbd2luZG93Ml07XG5cblxuICB2YXIgd2luZG93ID0gZDMuc2VsZWN0KGVsKS5zZWxlY3RBbGwoJ3N2ZycpLnNlbGVjdEFsbCgnZycpLmRhdGEod2luZG93cylcbiAgICAgICAgICAgICAgICAgIC5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAgICAgICAgICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnK2QueCArICcsJytkLnkrJyknO30pO1xuXG4gIHdpbmRvdy5hcHBlbmQoJ3JlY3QnKVxuICAgICAgICAgIC5hdHRyKCd3aWR0aCcsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQudzt9KVxuICAgICAgICAgIC5hdHRyKCdoZWlnaHQnLCBmdW5jdGlvbihkKSB7IHJldHVybiBkLmg7fSlcbiAgICAgICAgICAuYXR0cignZmlsbCcsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQuY29sb3I7fSlcbiAgICAgICAgICAuYXR0cignc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgICAgICAuYXR0cignZmlsbCcsICdub25lJylcbiAgICAgICAgICAuYXR0cignc3Ryb2tlJywgJ25vbmUnKVxuICAgICAgICAgIC5hdHRyKCdzdHJva2Utd2lkdGgnLCAnMnB4Jyk7XG5cbiAgLy8gd2luZG93LmFwcGVuZCgndGV4dCcpXG4gIC8vICAgICAgIC5hdHRyKCdjbGFzcycsICdheGlzJylcbiAgLy8gICAgICAgLmF0dHIoXCJ4XCIsIDApXG4gIC8vICAgICAgIC5hdHRyKFwieVwiLCAxMDAgKyAyMClcbiAgLy8gICAgICAgLmF0dHIoXCJkeVwiLCBcIi4zNWVtXCIpXG4gIC8vICAgICAgIC50ZXh0KGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC50ZXh0OyB9KTtcblxuICB3aW5kb3cuZWFjaChmdW5jdGlvbihkKSB7XG4gICAgIHZhciBmZWF0cyA9IGQzLnNlbGVjdCh0aGlzKS5zZWxlY3RBbGwoJy5mZWF0JykuZGF0YShkLmZlYXR1cmVzKTtcblxuICAgICBmZWF0cy5lbnRlcigpLmFwcGVuZCgnZycpXG4gICAgICAuYXR0cignY2xhc3MnLCAnZmVhdCcpXG4gICAgICAuYXR0cigndHJhbnNmb3JtJywgZnVuY3Rpb24oZCkgeyByZXR1cm4gJ3RyYW5zbGF0ZSgnK2QueCArICcsJysgZC55KycpJ30pXG4gICAgICAuZWFjaChmdW5jdGlvbihkKSB7XG4gICAgICAgIHZhciByZWN0cyA9IGQzLnNlbGVjdCh0aGlzKS5zZWxlY3RBbGwoJ3JlY3QnKS5kYXRhKGQucmVjdHMpO1xuXG4gICAgICAgIHJlY3RzLmVudGVyKCkuYXBwZW5kKCdyZWN0JylcbiAgICAgICAgICAuYXR0cigneCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC54OyB9KVxuICAgICAgICAgIC5hdHRyKCd5JywgZnVuY3Rpb24oZCkge3JldHVybiBkLnk7IH0pXG4gICAgICAgICAgLmF0dHIoJ3dpZHRoJywgZnVuY3Rpb24oZCkge3JldHVybiBkLnc7IH0pXG4gICAgICAgICAgLmF0dHIoJ2hlaWdodCcsIGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC5oOyB9KVxuICAgICAgICAgIC5hdHRyKCdmaWxsJywgZnVuY3Rpb24oZCkge3JldHVybiBkLmNvbG9yfSlcbiAgICAgICAgICAuYXR0cignc3Ryb2tlJywgJ2JsYWNrJylcbiAgICAgICAgICAuYXR0cignc3Ryb2tlLXdpZHRoJywgJzJweCcpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbm5zLmRlc3Ryb3kgPSBmdW5jdGlvbihlbCkge1xuXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IG5zO1xuIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi5hYnN7cG9zaXRpb246YWJzb2x1dGV9LnJlbHtwb3NpdGlvbjpyZWxhdGl2ZX0ucGl4ZWxhdGVke2ltYWdlLXJlbmRlcmluZzpwaXhlbGF0ZWR9XCI7aWYgKHN0eWxlLnN0eWxlU2hlZXQpeyBzdHlsZS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3M7IH0gZWxzZSB7IHN0eWxlLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNzcykpOyB9IGhlYWQuYXBwZW5kQ2hpbGQoc3R5bGUpO30oKSkiLCIvLyB2YXIgZDMgPSByZXF1aXJlKCdkMycpO1xuXG5yZXF1aXJlKCcuL2QzTGVnZW5kLmxlc3MnKTtcbnJlcXVpcmUoJy4vZDNCYXIubGVzcycpO1xucmVxdWlyZSgnLi9kM0F4aXMubGVzcycpO1xuXG52YXIgbnMgPSB7fTtcblxubnMuX21hcmdpbiA9IHt0b3A6IDIwLCByaWdodDogMzAsIGJvdHRvbTogMzAsIGxlZnQ6IDQwfTsgXG5cbm5zLl93aWR0aCA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHJldHVybiBwcm9wcy53aWR0aCAtIHRoaXMuX21hcmdpbi5sZWZ0IC0gdGhpcy5fbWFyZ2luLnJpZ2h0O1xufVxuXG5ucy5faGVpZ2h0ID0gZnVuY3Rpb24ocHJvcHMpIHtcbiAgcmV0dXJuIHByb3BzLmhlaWdodCAtIHRoaXMuX21hcmdpbi50b3AgLSB0aGlzLl9tYXJnaW4uYm90dG9tO1xufVxuXG5ucy5jcmVhdGUgPSBmdW5jdGlvbihlbCwgcHJvcHMsIHN0YXRlKSB7XG5cbiAgZDMuc2VsZWN0KGVsKS5hcHBlbmQoJ3N2ZycpXG4gICAgLmF0dHIoJ3dpZHRoJywgcHJvcHMud2lkdGgpXG4gICAgLmF0dHIoJ2hlaWdodCcsIHByb3BzLmhlaWdodClcbiAgICAuYXBwZW5kKCdnJylcbiAgICAuYXR0cignY2xhc3MnLCAnY2hhcnQnKVxuICAgIC5hdHRyKCd0cmFuc2Zvcm0nLCAndHJhbnNsYXRlKCcgKyB0aGlzLl9tYXJnaW4ubGVmdCArICcsJyArIHRoaXMuX21hcmdpbi50b3AgKyAnKScpO1xuXG4gIHRoaXMudXBkYXRlKGVsLCBwcm9wcyk7XG59XG5cbm5zLl9jb2xvciA9IGZ1bmN0aW9uKCkge1xuICB2YXIgY29sb3IgPSBkMy5zY2FsZS5vcmRpbmFsKClcbiAgICAgICAgICAgICAgLnJhbmdlKFtcIiM5OGFiYzVcIiwgXCIjOGE4OWE2XCIsIFwiIzdiNjg4OFwiLCBcIiM2YjQ4NmJcIiwgXCIjYTA1ZDU2XCIsIFwiI2QwNzQzY1wiLCBcIiNmZjhjMDBcIl0pO1xuICByZXR1cm4gY29sb3I7XG59XG5ucy5fYXhpcyA9IGZ1bmN0aW9uKHNjYWxlcykge1xuICB2YXIgeCA9IGQzLnN2Zy5heGlzKClcbiAgICAgICAgICAgICAgLnNjYWxlKHNjYWxlcy54KVxuICAgICAgICAgICAgICAub3JpZW50KCdib3R0b20nKTtcblxuICB2YXIgeSA9IGQzLnN2Zy5heGlzKClcbiAgICAgICAgICAgICAgLnNjYWxlKHNjYWxlcy55KVxuICAgICAgICAgICAgICAub3JpZW50KCdsZWZ0JylcbiAgICAgICAgICAgICAgLnRpY2tGb3JtYXQoZDMuZm9ybWF0KCcuMnMnKSk7XG5cbiAgcmV0dXJuIHt4OiB4LCB5OiB5fTtcbn1cblxubnMuX3NjYWxlcyA9IGZ1bmN0aW9uKHByb3BzKSB7XG4gIHdpZHRoID0gdGhpcy5fd2lkdGgocHJvcHMpO1xuICBoZWlnaHQgPSB0aGlzLl9oZWlnaHQocHJvcHMpO1xuXG4gIHZhciB5ID0gZDMuc2NhbGUubGluZWFyKClcbiAgICAgICAgICAucmFuZ2UoW2hlaWdodCwgMF0pO1xuXG4gIHZhciB4ID0gZDMuc2NhbGUub3JkaW5hbCgpXG4gICAgICAgICAgLnJhbmdlUm91bmRCYW5kcyhbMCwgd2lkdGhdLCAuMSk7XG5cbiAgcmV0dXJuIHt4OiB4LCB5OiB5fTtcbn1cblxubnMudXBkYXRlID0gZnVuY3Rpb24oZWwsIHByb3BzKSB7XG4gIHZhciB3aWR0aCA9IHRoaXMuX3dpZHRoKHByb3BzKTtcbiAgdmFyIGhlaWdodCA9IHRoaXMuX2hlaWdodChwcm9wcyk7XG4gIHZhciBzY2FsZXMgPSB0aGlzLl9zY2FsZXMocHJvcHMpO1xuICB2YXIgYXhpcyA9IHRoaXMuX2F4aXMoc2NhbGVzKTtcbiAgdmFyIGNvbG9yID0gdGhpcy5fY29sb3IoKTtcblxuICBkMy5jc3YocHJvcHMuY3N2LCBmdW5jdGlvbiAoZXJyb3IsIGRhdGEpIHtcbiAgICBpZiAoZXJyb3IpIHRocm93IGVycjtcblxuICAgIGNvbG9yLmRvbWFpbihkMy5rZXlzKGRhdGFbMF0pLmZpbHRlcihmdW5jdGlvbihrZXkpIHsgcmV0dXJuIGtleSAhPT0gJ1N0YXRlJzt9KSk7XG5cbiAgICBkYXRhLmZvckVhY2goZnVuY3Rpb24oZCkge1xuICAgICAgdmFyIHkwID0gMDtcbiAgICAgIGQuYWdlcyA9IGNvbG9yLmRvbWFpbigpLm1hcChmdW5jdGlvbihuYW1lKSB7IHJldHVybiB7bmFtZTpuYW1lLCB5MDp5MCwgeTE6IHkwICs9ICtkW25hbWVdfTt9KTtcbiAgICAgIGQudG90YWwgPSBkLmFnZXNbZC5hZ2VzLmxlbmd0aCAtMV0ueTE7XG4gICAgfSk7XG5cbiAgICBkYXRhLnNvcnQoZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYi50b3RhbCAtIGEudG90YWw7IH0pO1xuXG4gICAgc2NhbGVzLnguZG9tYWluKGRhdGEubWFwKGZ1bmN0aW9uKGQpIHtyZXR1cm4gZC5TdGF0ZTsgfSkpO1xuICAgIHNjYWxlcy55LmRvbWFpbihbMCwgZDMubWF4KGRhdGEsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGQudG90YWw7IH0pXSk7XG5cbiAgICB2YXIgY2hhcnQgPSBkMy5zZWxlY3QoZWwpLnNlbGVjdCgnLmNoYXJ0Jyk7XG5cbiAgICBjaGFydC5hcHBlbmQoJ2cnKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ3ggYXhpcycpXG4gICAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZSgwLCBcIiArIGhlaWdodCArIFwiKVwiKVxuICAgICAgLmNhbGwoYXhpcy54KTtcblxuICAgIGNoYXJ0LmFwcGVuZChcImdcIilcbiAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ5IGF4aXNcIilcbiAgICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgLSAzICsgXCIsMClcIilcbiAgICAgIC5jYWxsKGF4aXMueSlcbiAgICAgIC5hcHBlbmQoJ3RleHQnKVxuICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsICdyb3RhdGUoLTkwKScpXG4gICAgICAuYXR0cigneScsIDYpXG4gICAgICAuYXR0cignZHknLCAnLjcxZW0nKVxuICAgICAgLnN0eWxlKCd0ZXh0LWFuY2hvcicsICdlbmQnKVxuICAgICAgLnRleHQoJ1BvcHVsYXRpb24nKTtcblxuXG4gICAgLy8gZGF0YSBqb2luIChlbnRlciBvbmx5KVxuICAgIHZhciBzdGF0ZSA9IGNoYXJ0LnNlbGVjdEFsbCgnLnN0YXRlJylcbiAgICAgICAgICAgLmRhdGEoZGF0YSlcbiAgICAgICAgICAgLmVudGVyKCkuYXBwZW5kKCdnJylcbiAgICAgICAgICAgLmF0dHIoJ2NsYXNzJywgJ3N0YXRlJylcbiAgICAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIFwidHJhbnNsYXRlKFwiICsgc2NhbGVzLngoZC5TdGF0ZSkgKyBcIiwgMClcIjsgfSk7XG5cbiAgICBzdGF0ZS5zZWxlY3RBbGwoJ3JlY3QnKVxuICAgICAgICAuZGF0YShmdW5jdGlvbihkKSB7cmV0dXJuIGQuYWdlczt9KVxuICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ3JlY3QnKVxuICAgICAgICAuYXR0cihcIndpZHRoXCIsIHNjYWxlcy54LnJhbmdlQmFuZCgpKVxuICAgICAgICAuYXR0cihcInlcIiwgZnVuY3Rpb24oZCkgeyByZXR1cm4gc2NhbGVzLnkoZC55MSk7IH0pXG4gICAgICAgIC5hdHRyKFwiaGVpZ2h0XCIsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIHNjYWxlcy55KGQueTApIC0gc2NhbGVzLnkoZC55MSk7IH0pXG4gICAgICAgIC5zdHlsZSgnZmlsbCcsIGZ1bmN0aW9uKGQpIHsgcmV0dXJuIGNvbG9yKGQubmFtZSk7IH0pO1xuXG4gICAgdmFyIGxlZ2VuZCA9IGNoYXJ0LnNlbGVjdEFsbCgnLmxlZ2VuZCcpXG4gICAgICAgIC5kYXRhKGNvbG9yLmRvbWFpbigpLnNsaWNlKCkucmV2ZXJzZSgpKVxuICAgICAgICAuZW50ZXIoKS5hcHBlbmQoJ2cnKVxuICAgICAgICAuYXR0cignY2xhc3MnLCAnbGVnZW5kJylcbiAgICAgICAgLmF0dHIoJ3RyYW5zZm9ybScsIGZ1bmN0aW9uKGQsIGkpIHsgcmV0dXJuICd0cmFuc2xhdGUoMCwgJyArIGkgKiAyMCArICcpJzsgfSk7XG5cbiAgICBsZWdlbmQuYXBwZW5kKCdyZWN0JylcbiAgICAgIC5hdHRyKCd4Jywgd2lkdGggLSAxOClcbiAgICAgIC5hdHRyKCd3aWR0aCcsIDE4KVxuICAgICAgLmF0dHIoJ2hlaWdodCcsIDE4KVxuICAgICAgLnN0eWxlKCdmaWxsJywgY29sb3IpXG4gICAgbGVnZW5kLmFwcGVuZCgndGV4dCcpXG4gICAgICAgIC5hdHRyKFwieFwiLCB3aWR0aCAtIDI0KVxuICAgICAgICAuYXR0cihcInlcIiwgOSlcbiAgICAgICAgLmF0dHIoXCJkeVwiLCBcIi4zNWVtXCIpXG4gICAgICAgIC5zdHlsZShcInRleHQtYW5jaG9yXCIsIFwiZW5kXCIpXG4gICAgICAgIC50ZXh0KGZ1bmN0aW9uKGQpIHtyZXR1cm4gZDsgfSk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIHR5cGUoZCkge1xuICAgIGQudmFsdWUgPSArZC52YWx1ZTsgLy9jb2VyY2UgdG8gbnVtYmVyXG4gICAgcmV0dXJuIGQ7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRfcGVyY2VudChkLCBuKSB7XG4gICAgcGVyY2VudCA9ICsoZC5zcGxpdChcIiVcIilbMF0pXG4gICAgbmV3UGVyY2VudCA9IHBlcmNlbnQgKyBuXG4gICAgcmV0dXJuIFwiXCIgKyBuZXdQZXJjZW50ICsgXCIlXCI7XG4gIH1cbn07XG5cbm5zLmRlc3Ryb3kgPSBmdW5jdGlvbihlbCkge307XG5cbm1vZHVsZS5leHBvcnRzID0gbnM7XG4iLCIoZnVuY3Rpb24oKSB7IHZhciBoZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXTsgdmFyIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTsgc3R5bGUudHlwZSA9ICd0ZXh0L2Nzcyc7dmFyIGNzcyA9IFwiLm1hcmtkb3duIHRhYmxle2JvcmRlci1zcGFjaW5nOjEwcHg7Ym9yZGVyLWNvbGxhcHNlOnNlcGFyYXRlfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIiwiKGZ1bmN0aW9uKCkgeyB2YXIgaGVhZCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF07IHZhciBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7IHN0eWxlLnR5cGUgPSAndGV4dC9jc3MnO3ZhciBjc3MgPSBcIi50aWxle3NoYXBlLXJlbmRlcmluZzpjcmlzcEVkZ2VzfVwiO2lmIChzdHlsZS5zdHlsZVNoZWV0KXsgc3R5bGUuc3R5bGVTaGVldC5jc3NUZXh0ID0gY3NzOyB9IGVsc2UgeyBzdHlsZS5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjc3MpKTsgfSBoZWFkLmFwcGVuZENoaWxkKHN0eWxlKTt9KCkpIl19
