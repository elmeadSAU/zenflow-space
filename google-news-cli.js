#!/usr/bin/env node

/**
 * Google News CLI
 * A zero-dependency, feature-rich command-line utility to fetch, search, filter,
 * and read the latest news from Google News directly in the terminal.
 */

const { exec } = require('child_process');
const readline = require('readline');
const https = require('https');

// ANSI escape codes for terminal coloring
const style = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright colors
  brightCyan: '\x1b[96m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightMagenta: '\x1b[95m',
  brightRed: '\x1b[91m',
};

// Available Topics mapping
const TOPICS = {
  world: { name: 'World News', path: 'WORLD' },
  nation: { name: 'Nation News (US)', path: 'NATION' },
  business: { name: 'Business', path: 'BUSINESS' },
  technology: { name: 'Technology', path: 'TECHNOLOGY' },
  entertainment: { name: 'Entertainment', path: 'ENTERTAINMENT' },
  sports: { name: 'Sports', path: 'SPORTS' },
  science: { name: 'Science', path: 'SCIENCE' },
  health: { name: 'Health', path: 'HEALTH' }
};

// Help menu content
const HELP_TEXT = `
${style.bold}${style.brightCyan}Google News CLI${style.reset} - Get latest news from Google directly in your terminal.

${style.bold}Usage:${style.reset}
  node google-news-cli.js [options]

${style.bold}Options:${style.reset}
  -s, --search <query>   Search for news articles matching the query.
  -t, --topic <topic>     Filter by a specific topic:
                          [world, nation, business, technology, entertainment, sports, science, health]
  -l, --limit <number>    Limit the number of articles displayed (default: 10).
  -j, --json              Output raw JSON instead of the interactive terminal UI.
  -h, --help              Display this help message.

${style.bold}Interactive Mode:${style.reset}
  Run without any arguments to start interactive mode:
  node google-news-cli.js
`;

/**
 * Decode XML entities to standard text
 */
function decodeXml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Clean HTML tags from a string
 */
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Convert publication date to a friendly relative timestamp
 */
function timeAgo(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (isNaN(seconds)) return dateString;
    
    if (seconds < 60) return 'just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return days === 1 ? '1 day ago' : `${days} days ago`;
    
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
    
    return date.toLocaleDateString();
  } catch (e) {
    return dateString;
  }
}

/**
 * Fetch feed content using native fetch or fallback to https module
 */
async function fetchXml(url) {
  if (typeof fetch === 'function') {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.text();
  } else {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP error! status: ${res.statusCode}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }
}

/**
 * Simple XML parser to parse RSS feed
 */
function parseRss(xmlText) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);
    
    let fullTitle = titleMatch ? stripHtml(decodeXml(titleMatch[1].trim())) : '';
    let link = linkMatch ? decodeXml(linkMatch[1].trim()) : '';
    let pubDate = pubDateMatch ? decodeXml(pubDateMatch[1].trim()) : '';
    let source = sourceMatch ? stripHtml(decodeXml(sourceMatch[1].trim())) : '';
    
    // Clean up title: Google News titles usually end with " - Source Name"
    let title = fullTitle;
    if (source && title.endsWith(` - ${source}`)) {
      title = title.substring(0, title.length - ` - ${source}`.length);
    }
    
    items.push({
      title,
      fullTitle,
      link,
      pubDate,
      source: source || 'Unknown Source',
      timeAgo: timeAgo(pubDate)
    });
  }
  
  return items;
}

/**
 * Generate Google News RSS feed URL based on search query or topic
 */
function getFeedUrl(search, topic) {
  const baseUrl = 'https://news.google.com/rss';
  const queryParams = 'hl=en-US&gl=US&ceid=US:en';
  
  if (search) {
    return `${baseUrl}/search?q=${encodeURIComponent(search)}&${queryParams}`;
  }
  
  if (topic && TOPICS[topic.toLowerCase()]) {
    const topicPath = TOPICS[topic.toLowerCase()].path;
    return `${baseUrl}/headlines/section/topic/${topicPath}?${queryParams}`;
  }
  
  return `${baseUrl}?${queryParams}`;
}

/**
 * Open URL in default web browser
 */
function openUrl(url) {
  let command;
  switch (process.platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "" "${url.replace(/&/g, '^&')}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
      break;
  }
  exec(command, (err) => {
    if (err) {
      console.error(`\n${style.brightRed}Failed to open browser: ${err.message}${style.reset}\n`);
    } else {
      console.log(`\n${style.brightGreen}Opened article in your browser!${style.reset}\n`);
    }
  });
}

/**
 * Custom line reader prompt helper
 */
function askQuestion(rl, query) {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Loading indicator
 */
let spinnerInterval;
function startLoading(message) {
  const chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  process.stdout.write(`\r${message}  `);
  spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${chars[i]} ${message}`);
    i = (i + 1) % chars.length;
  }, 100);
}

function stopLoading() {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    process.stdout.write('\r\x1b[K'); // clear line
  }
}

/**
 * Parse CLI Arguments
 */
function parseArgs(args) {
  const options = {
    search: null,
    topic: null,
    limit: 10,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--json' || arg === '-j') {
      options.json = true;
    } else if (arg === '--search' || arg === '-s') {
      options.search = args[++i] || '';
    } else if (arg === '--topic' || arg === '-t') {
      options.topic = args[++i] || '';
    } else if (arg === '--limit' || arg === '-l') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val) && val > 0) {
        options.limit = val;
      }
    }
  }
  return options;
}

/**
 * Format and print a single article
 */
function printArticle(index, article) {
  console.log(`${style.bold}${style.brightCyan}${index}. ${article.title}${style.reset}`);
  console.log(`   ${style.brightGreen}${article.source}${style.reset} ${style.dim}• ${article.timeAgo}${style.reset}`);
  console.log(`   ${style.underline}${style.dim}${article.link}${style.reset}\n`);
}

/**
 * Interactive News Browser loop
 */
async function newsViewerLoop(rl, articles) {
  while (true) {
    console.log(`${style.dim}------------------------------------------------------------${style.reset}`);
    const answer = await askQuestion(rl, `${style.bold}Enter number to open in browser, 'm' for main menu, or 'q' to quit: ${style.reset}`);
    
    if (answer.toLowerCase() === 'q') {
      rl.close();
      process.exit(0);
    }
    
    if (answer.toLowerCase() === 'm') {
      return; // Return to main menu
    }
    
    const index = parseInt(answer, 10);
    if (!isNaN(index) && index >= 1 && index <= articles.length) {
      const article = articles[index - 1];
      openUrl(article.link);
    } else {
      console.log(`${style.brightRed}Invalid selection. Please enter a valid article number, 'm', or 'q'.${style.reset}`);
    }
  }
}

/**
 * Interactive Mode main flow
 */
async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    console.clear();
    console.log(`============================================================`);
    console.log(` ${style.bold}${style.brightCyan}📰 GOOGLE NEWS COMMAND LINE INTERFACE${style.reset}`);
    console.log(`============================================================`);
    console.log(`Select a category or action:`);
    console.log(`  1) Top Stories (US)`);
    console.log(`  2) World News`);
    console.log(`  3) Nation News (US)`);
    console.log(`  4) Business`);
    console.log(`  5) Technology`);
    console.log(`  6) Entertainment`);
    console.log(`  7) Sports`);
    console.log(`  8) Science`);
    console.log(`  9) Health`);
    console.log(`  s) Search Custom Query`);
    console.log(`  q) Exit CLI`);
    console.log(`------------------------------------------------------------`);
    
    const choice = await askQuestion(rl, `${style.bold}Choose an option: ${style.reset}`);
    
    if (choice.toLowerCase() === 'q') {
      rl.close();
      console.log(`\nThanks for reading! Goodbye.`);
      process.exit(0);
    }
    
    let search = null;
    let topic = null;
    let title = 'Top Stories';

    if (choice === '1') {
      title = 'Top Stories (US)';
    } else if (choice === '2') {
      topic = 'world';
      title = 'World News';
    } else if (choice === '3') {
      topic = 'nation';
      title = 'Nation News (US)';
    } else if (choice === '4') {
      topic = 'business';
      title = 'Business News';
    } else if (choice === '5') {
      topic = 'technology';
      title = 'Technology News';
    } else if (choice === '6') {
      topic = 'entertainment';
      title = 'Entertainment News';
    } else if (choice === '7') {
      topic = 'sports';
      title = 'Sports News';
    } else if (choice === '8') {
      topic = 'science';
      title = 'Science News';
    } else if (choice === '9') {
      topic = 'health';
      title = 'Health News';
    } else if (choice.toLowerCase() === 's') {
      search = await askQuestion(rl, `\n${style.bold}Enter search query: ${style.reset}`);
      if (!search) {
        console.log(`${style.brightRed}Query cannot be empty. Press enter to return...${style.reset}`);
        await askQuestion(rl, '');
        continue;
      }
      title = `Search results for: "${search}"`;
    } else {
      console.log(`\n${style.brightRed}Invalid option. Press Enter to continue...${style.reset}`);
      await askQuestion(rl, '');
      continue;
    }

    const url = getFeedUrl(search, topic);
    console.log('');
    startLoading('Fetching articles...');
    
    try {
      const xml = await fetchXml(url);
      stopLoading();
      const articles = parseRss(xml).slice(0, 15); // Show top 15 in interactive list
      
      console.clear();
      console.log(`============================================================`);
      console.log(` 📰 ${style.bold}${style.brightCyan}${title.toUpperCase()}${style.reset}`);
      console.log(`============================================================\n`);
      
      if (articles.length === 0) {
        console.log(`No articles found.\n`);
      } else {
        articles.forEach((art, idx) => {
          printArticle(idx + 1, art);
        });
        
        await newsViewerLoop(rl, articles);
      }
    } catch (err) {
      stopLoading();
      console.log(`\n${style.brightRed}Error loading news: ${err.message}${style.reset}`);
      console.log(`Press Enter to return to main menu...`);
      await askQuestion(rl, '');
    }
  }
}

/**
 * Command Line direct execution (non-interactive)
 */
async function runDirect(options) {
  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.topic && !TOPICS[options.topic.toLowerCase()]) {
    console.error(`${style.brightRed}Error: Invalid topic "${options.topic}".${style.reset}`);
    console.error(`Available topics: world, nation, business, technology, entertainment, sports, science, health`);
    process.exit(1);
  }

  const url = getFeedUrl(options.search, options.topic);

  try {
    const xml = await fetchXml(url);
    const articles = parseRss(xml).slice(0, options.limit);

    if (options.json) {
      console.log(JSON.stringify(articles, null, 2));
      process.exit(0);
    }

    let header = 'Latest News';
    if (options.search) header = `Search Results for "${options.search}"`;
    else if (options.topic) header = `${TOPICS[options.topic.toLowerCase()].name} News`;

    console.log(`\n============================================================`);
    console.log(` 📰 ${style.bold}${style.brightCyan}${header.toUpperCase()}${style.reset}`);
    console.log(`============================================================\n`);

    if (articles.length === 0) {
      console.log(`No articles found.\n`);
    } else {
      articles.forEach((art, idx) => {
        printArticle(idx + 1, art);
      });
    }
  } catch (err) {
    console.error(`${style.brightRed}Error loading news: ${err.message}${style.reset}`);
    process.exit(1);
  }
}

/**
 * Main execution entry point
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    const options = parseArgs(args);
    runDirect(options);
  } else {
    runInteractive();
  }
}

main();
