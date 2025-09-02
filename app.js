// PDF Parser for Schedule Import
// מנתח PDF לייבוא אירועים ללוח השנה

// Configure PDF.js - using global variable since it's loaded as script
const pdfjsLib = window.pdfjsLib;
if (pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

class PDFEventParser {
    constructor() {
        this.parsedEvents = [];
        this.currentStep = 1;
        this.maxSteps = 3;
    }

    // Main function to parse PDF and extract events
    async parsePDF(file) {
        try {
            console.log('🔍 Starting PDF parsing...');
            
            // Read PDF file
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            console.log(`📄 PDF loaded: ${pdf.numPages} pages`);
            
            // Extract text from all pages
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageText = content.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
                console.log(`📝 Page ${i} text length: ${pageText.length} characters`);
                
                // Show first 200 chars of each page for debugging
                if (pageText.length > 0) {
                    console.log(`📖 Page ${i} preview: "${pageText.substring(0, 200)}..."`);
                }
            }
            
            console.log(`📝 Total text extracted: ${fullText.length} characters`);
            console.log('📝 Full text extracted, analyzing...');
            
            // Save raw text for debugging
            this.rawText = fullText;
            
            // Parse events from text
            this.parsedEvents = this.extractEvents(fullText);
            
            console.log(`✅ Found ${this.parsedEvents.length} potential events`);
            
            // Show first few events found
            if (this.parsedEvents.length > 0) {
                console.log('🎯 First few events found:');
                this.parsedEvents.slice(0, 5).forEach((event, index) => {
                    console.log(`   ${index + 1}. ${event.name} on ${event.date.toLocaleDateString()}`);
                });
            }
            
            return this.parsedEvents;
            
        } catch (error) {
            console.error('❌ PDF parsing error:', error);
            throw new Error(`שגיאה בקריאת הקובץ: ${error.message}`);
        }
    }

    // Extract events from text using pattern matching
    extractEvents(text) {
        const events = [];
        let lines = text.split('\n').filter(line => line.trim());
        
        console.log('🔍 Total lines to analyze:', lines.length);
        console.log('📝 First 10 lines:', lines.slice(0, 10));
        
        // Special handling for single-line PDFs (like school calendars)
        if (lines.length === 1 && lines[0].length > 500) {
            console.log('🔄 Detected single-line format, splitting into events...');
            lines = this.splitSingleLineCalendar(lines[0]);
            console.log(`📊 Split into ${lines.length} potential event lines`);
        }
        
        // Hebrew months mapping
        const hebrewMonths = {
            'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4, 'מאי': 5, 'יוני': 6,
            'יולי': 7, 'אוגוסט': 8, 'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12,
            'תשרי': 9, 'מרחשוון': 10, 'כסלו': 11, 'טבת': 12, 'שבט': 1, 'אדר': 2,
            'ניסן': 3, 'אייר': 4, 'סיון': 5, 'תמוז': 6, 'אב': 7, 'אלול': 8
        };

        // English months mapping
        const englishMonths = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
            'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7, 'aug': 8,
            'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        };

        // Enhanced date patterns for school calendar format
        const datePatterns = [
            // Weekday, Month DD format (like "Tuesday, September 2") - MOST COMMON IN SCHOOL CALENDARS
            /(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi,
            // Month DD, YYYY (English)
            /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi,
            // Month DD (current year assumed)
            /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/gi,
            // DD/MM/YYYY or DD.MM.YYYY
            /(?:יום\s+)?(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/g,
            // DD MM YYYY (Hebrew)
            /(\d{1,2})\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(\d{4})/gi,
            // ISO format YYYY-MM-DD
            /(\d{4})-(\d{1,2})-(\d{1,2})/g,
            // Date ranges like "December 22, -January 2, 2026" or "March 16-27"
            /(december|january|february|march|april|may|june|july|august|september|october|november)\s+(\d{1,2}),?\s*[-–]\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi,
            // Simple month-day ranges like "March 16-27"
            /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})[-–](\d{1,2})/gi
        ];

        let currentDate = null;
        let currentYear = 2025; // Default year for school calendar

        // Track what we find for debugging
        let dateMatches = 0;
        let eventMatches = 0;
        let skippedLines = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.length < 3) {
                skippedLines++;
                continue;
            }

            // Try to extract date from line
            const extractedDate = this.extractDateFromLine(line, datePatterns, hebrewMonths, englishMonths, currentYear);
            if (extractedDate) {
                currentDate = extractedDate;
                currentYear = extractedDate.getFullYear();
                dateMatches++;
                console.log(`📅 Found date: ${currentDate.toLocaleDateString()} from line: "${line.substring(0, 100)}..."`);
                
                // Look ahead for event on same line
                const inlineEvent = this.extractEventFromSameLine(line);
                if (inlineEvent) {
                    const category = this.categorizeEvent(inlineEvent);
                    const participants = this.getDefaultParticipants(category);
                    
                    events.push({
                        date: new Date(currentDate),
                        name: inlineEvent,
                        category: category,
                        participants: participants,
                        rawLine: line,
                        timeSlot: '09:00-17:00'
                    });
                    eventMatches++;
                    console.log(`✅ Found inline event: "${inlineEvent}"`);
                }
                continue;
            }

            // If we have a current date, try to extract event from this line
            if (currentDate && !this.isDateLine(line)) {
                const eventName = this.extractEventName(line, i, lines);
                if (eventName) {
                    const category = this.categorizeEvent(eventName);
                    const participants = this.getDefaultParticipants(category);
                    
                    // Check if this is a duplicate (sometimes events appear on multiple lines)
                    const isDuplicate = events.some(existingEvent => 
                        existingEvent.date.toDateString() === currentDate.toDateString() &&
                        this.calculateSimilarity(existingEvent.name.toLowerCase(), eventName.toLowerCase()) > 0.7
                    );
                    
                    if (!isDuplicate) {
                        events.push({
                            date: new Date(currentDate),
                            name: eventName,
                            category: category,
                            participants: participants,
                            rawLine: line,
                            timeSlot: '09:00-17:00'
                        });
                        eventMatches++;
                        console.log(`✅ Found event: "${eventName}" for date: ${currentDate.toLocaleDateString()}`);
                    } else {
                        console.log(`🗑️ Skipping duplicate event: "${eventName}"`);
                    }
                }
            }
            
            // Special handling for table-like formats where date and event might be separated
            if (!currentDate && i < lines.length - 1) {
                const nextLine = lines[i + 1].trim();
                const combinedLine = `${line} ${nextLine}`;
                
                const combinedDate = this.extractDateFromLine(combinedLine, datePatterns, hebrewMonths, englishMonths, currentYear);
                if (combinedDate) {
                    currentDate = combinedDate;
                    currentYear = combinedDate.getFullYear();
                    dateMatches++;
                    console.log(`📅 Found date from combined lines: ${currentDate.toLocaleDateString()}`);
                    
                    // Extract event from the combined content
                    const combinedEvent = this.extractEventFromSameLine(combinedLine);
                    if (combinedEvent) {
                        const category = this.categorizeEvent(combinedEvent);
                        const participants = this.getDefaultParticipants(category);
                        
                        events.push({
                            date: new Date(currentDate),
                            name: combinedEvent,
                            category: category,
                            participants: participants,
                            rawLine: combinedLine,
                            timeSlot: '09:00-17:00'
                        });
                        eventMatches++;
                        console.log(`✅ Found combined event: "${combinedEvent}"`);
                        i++; // Skip next line since we processed it
                    }
                }
            }
        }
        
        console.log(`📊 Parsing summary: ${dateMatches} dates found, ${eventMatches} events found, ${skippedLines} lines skipped`);
        
        // If we found very few events, try alternative parsing strategies
        if (events.length < 3 && lines.length > 20) {
            console.log(`🔄 Low event count (${events.length}), trying alternative parsing...`);
            const alternativeEvents = this.tryAlternativeParsing(lines, hebrewMonths, englishMonths, currentYear);
            events.push(...alternativeEvents);
            console.log(`🔄 Alternative parsing found ${alternativeEvents.length} additional events`);
        }

        // Remove duplicates and sort by date
        const uniqueEvents = this.removeDuplicates(events);
        uniqueEvents.sort((a, b) => a.date - b.date);
        
        return uniqueEvents;
    }

    // NEW: Split single-line calendar into individual event lines
    splitSingleLineCalendar(longLine) {
        console.log('🔄 Splitting single-line calendar format...');
        
        // Split by weekday patterns - this is the most reliable separator for school calendars
        const weekdayPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi;
        
        const matches = [];
        let match;
        
        // Find all weekday-date patterns and their positions
        while ((match = weekdayPattern.exec(longLine)) !== null) {
            matches.push({
                match: match[0],
                index: match.index,
                fullMatch: match
            });
        }
        
        console.log(`📅 Found ${matches.length} date patterns in single line`);
        
        if (matches.length === 0) {
            // Fallback: split by common separators
            return longLine.split(/\s{4,}|\t/).filter(part => part.trim().length > 10);
        }
        
        // Split the text based on date positions
        const eventLines = [];
        
        for (let i = 0; i < matches.length; i++) {
            const currentMatch = matches[i];
            const nextMatch = matches[i + 1];
            
            const startPos = currentMatch.index;
            const endPos = nextMatch ? nextMatch.index : longLine.length;
            
            const eventText = longLine.substring(startPos, endPos).trim();
            
            if (eventText.length > 10) { // Only meaningful chunks
                eventLines.push(eventText);
                console.log(`📝 Split event: "${eventText.substring(0, 100)}..."`);
            }
        }
        
        // If we still have very few lines, try additional splitting methods
        if (eventLines.length < 5) {
            console.log('🔄 Few events found, trying additional splitting...');
            
            // Try splitting by month names (for events without weekdays)
            const monthPattern = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi;
            const additionalMatches = [];
            let monthMatch;
            
            while ((monthMatch = monthPattern.exec(longLine)) !== null) {
                // Check if this match is not already captured by weekday pattern
                const isNewMatch = !matches.some(existing => 
                    Math.abs(existing.index - monthMatch.index) < 20
                );
                
                if (isNewMatch) {
                    additionalMatches.push({
                        match: monthMatch[0],
                        index: monthMatch.index,
                        fullMatch: monthMatch
                    });
                }
            }
            
            console.log(`📅 Found ${additionalMatches.length} additional month patterns`);
            
            // Process additional matches
            for (let i = 0; i < additionalMatches.length; i++) {
                const currentMatch = additionalMatches[i];
                const nextMatch = additionalMatches[i + 1];
                
                const startPos = currentMatch.index;
                const endPos = nextMatch ? nextMatch.index : longLine.length;
                
                const eventText = longLine.substring(startPos, endPos).trim();
                
                if (eventText.length > 10 && !eventLines.some(existing => existing.includes(eventText))) {
                    eventLines.push(eventText);
                    console.log(`📝 Additional event: "${eventText.substring(0, 100)}..."`);
                }
            }
        }
        
        console.log(`✅ Successfully split into ${eventLines.length} event lines`);
        return eventLines;
    }

    extractDateFromLine(line, patterns, hebrewMonths, englishMonths, currentYear) {
        // Try each pattern
        for (const pattern of patterns) {
            pattern.lastIndex = 0; // Reset regex
            const match = pattern.exec(line.toLowerCase()); // Convert to lowercase for matching
            if (match) {
                try {
                    let day, month, year;
                    
                    // Handle different pattern formats
                    if (pattern.source.includes('monday|tuesday|wednesday') && pattern.source.includes('january|february')) {
                        // Weekday, Month DD format (most common in school calendars)
                        const monthName = match[2].toLowerCase();
                        month = englishMonths[monthName];
                        day = parseInt(match[3]);
                        year = currentYear;
                        console.log(`📅 Parsed weekday format: ${day}/${month}/${year} from "${match[0]}"`);
                    } else if (pattern.source.includes('january|february') && pattern.source.includes('\\d{4}')) {
                        // Month DD, YYYY format
                        const monthName = match[1].toLowerCase();
                        month = englishMonths[monthName];
                        day = parseInt(match[2]);
                        year = match[3] ? parseInt(match[3]) : currentYear;
                        console.log(`📅 Parsed month+year format: ${day}/${month}/${year} from "${match[0]}"`);
                    } else if (pattern.source.includes('january|february') && pattern.source.includes('\\b')) {
                        // Month DD (current year assumed)
                        const monthName = match[1].toLowerCase();
                        month = englishMonths[monthName];
                        day = parseInt(match[2]);
                        year = currentYear;
                        console.log(`📅 Parsed month format: ${day}/${month}/${year} from "${match[0]}"`);
                    } else if (pattern.source.includes('march.*16.*27')) {
                        // Simple month-day ranges like "March 16-27"
                        const monthName = match[1].toLowerCase();
                        month = englishMonths[monthName];
                        day = parseInt(match[2]); // Use start day
                        year = currentYear;
                        console.log(`📅 Parsed range format: ${day}/${month}/${year} from "${match[0]}"`);
                    } else if (pattern.source.includes('december.*january')) {
                        // Date range format like "December 22, -January 2, 2026"
                        const startMonth = englishMonths[match[1].toLowerCase()];
                        const startDay = parseInt(match[2]);
                        const endMonth = englishMonths[match[3].toLowerCase()];
                        const endDay = parseInt(match[4]);
                        year = parseInt(match[5]);
                        
                        // Return the start date for date ranges
                        month = startMonth;
                        day = startDay;
                        console.log(`📅 Parsed date range: ${day}/${month}/${year} from "${match[0]}"`);
                    } else if (pattern.source.includes('ינואר|פברואר')) {
                        // Hebrew month name format
                        day = parseInt(match[1]);
                        month = hebrewMonths[match[2]];
                        year = parseInt(match[3]);
                        console.log(`📅 Parsed Hebrew format: ${day}/${month}/${year} from "${match[0]}"`);
                    } else if (match[1] && match[2] && match[3]) {
                        // Numeric format
                        if (match[1].length === 4) {
                            // YYYY-MM-DD
                            year = parseInt(match[1]);
                            month = parseInt(match[2]);
                            day = parseInt(match[3]);
                        } else {
                            // DD/MM/YYYY
                            day = parseInt(match[1]);
                            month = parseInt(match[2]);
                            year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
                        }
                        console.log(`📅 Parsed numeric format: ${day}/${month}/${year} from "${match[0]}"`);
                    }

                    // Validate date
                    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
                        const parsedDate = new Date(year, month - 1, day);
                        console.log(`✅ Valid date created: ${parsedDate.toLocaleDateString()}`);
                        return parsedDate;
                    } else {
                        console.log(`❌ Invalid date values: ${day}/${month}/${year}`);
                    }
                } catch (error) {
                    console.warn('Date parsing error:', error);
                }
            }
        }
        return null;
    }

    // NEW: Extract event from same line as date
    extractEventFromSameLine(line) {
        // Remove the date part and extract the event
        let dateRemovedLine = line
            .replace(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/gi, '')
            .replace(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}/gi, '')
            .replace(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi, '')
            .replace(/\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4}/g, '')
            .replace(/^(2025|2026)\s*/gi, '') // Remove year prefixes
            .trim();
        
        // If what's left is substantial and not a header/metadata
        if (dateRemovedLine.length > 3 && !this.isHeaderLine(dateRemovedLine) && !this.isMetadataLine(dateRemovedLine)) {
            const cleaned = this.cleanEventName(dateRemovedLine);
            if (cleaned.length > 2) {
                console.log(`🎯 Extracted inline event: "${cleaned}" from line: "${line}"`);
                return cleaned;
            }
        }
        return null;
    }

    extractEventName(line, currentIndex, lines) {
        // Skip obvious header lines
        if (this.isHeaderLine(line)) {
            console.log(`⏭️ Skipping header line: "${line}"`);
            return null;
        }
        
        // Skip date-only lines
        if (this.isDateLine(line)) {
            console.log(`⏭️ Skipping date line: "${line}"`);
            return null;
        }
        
        // Skip if line is too short or looks like metadata
        if (line.length < 4 || this.isMetadataLine(line)) {
            console.log(`⏭️ Skipping short/metadata line: "${line}"`);
            return null;
        }
        
        // Remove common prefixes and suffixes
        let eventName = line
            .replace(/^[\d\-\.\s\/]+/, '') // Remove leading dates and numbers
            .replace(/\s*(school closed|partial day|dismissal time|available on|statutory holiday).*$/gi, '') // Remove school-specific suffixes
            .replace(/\s*\d{1,2}:\d{2}(am|pm)?\s*$/gi, '') // Remove trailing times
            .replace(/^(date|event|explanation|purpose)\s*/gi, '') // Remove column headers
            .replace(/^(2025|2026)\s*/gi, '') // Remove year prefixes
            .trim();

        // Skip very common non-event words/lines
        const skipWords = [
            'calendar', 'information', 'new westminster', 'school district', 'elementary',
            'lord kelvin', 'explanation', 'purpose', 'date', 'event'
        ];
        
        const lowerEventName = eventName.toLowerCase();
        if (skipWords.some(word => lowerEventName === word || lowerEventName.includes(word + ' ') || lowerEventName.startsWith(word))) {
            console.log(`⏭️ Skipping common word: "${eventName}"`);
            return null;
        }

        // Clean up the event name further
        eventName = this.cleanEventName(eventName);

        // Final length check
        if (eventName.length < 3) {
            console.log(`⏭️ Event name too short after cleaning: "${eventName}"`);
            return null;
        }

        // If this looks like it might be a table format, try next line too
        if (eventName.length < 15 && currentIndex < lines.length - 1) {
            const nextLine = lines[currentIndex + 1].trim();
            if (nextLine.length > eventName.length && !this.isDateLine(nextLine) && !this.isHeaderLine(nextLine)) {
                const combinedName = `${eventName} - ${this.cleanEventName(nextLine)}`.trim();
                if (combinedName.length > eventName.length && combinedName.length < 100) {
                    console.log(`🔗 Combined with next line: "${combinedName}"`);
                    return combinedName;
                }
            }
        }

        console.log(`✨ Extracted event name: "${eventName}"`);
        return eventName;
    }

    // NEW: Check if line is metadata/formatting
    isMetadataLine(line) {
        const metadataPatterns = [
            /^\d+$/, // Just a number
            /^page \d+/gi,
            /^continued/gi,
            /^\s*[-_=]+\s*$/, // Just dashes/underscores
            /^lord kelvin elementary/gi,
            /^new westminster school district/gi
        ];
        
        return metadataPatterns.some(pattern => pattern.test(line.trim()));
    }

    cleanEventName(name) {
        return name
            .replace(/^[•\-\*\d\.\s]+/, '') // Remove bullet points and numbering
            .replace(/^\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*/gi, '') // Remove day names
            .replace(/^\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*/gi, '') // Remove dates
            .replace(/\s*(school closed|partial day|dismissal time|available on|first day|last day).*$/gi, '') // Remove explanations
            .replace(/\s*\d{1,2}:\d{2}(am|pm)?\s*$/, '') // Remove times
            .replace(/^\s*[-–]\s*/, '') // Remove leading dashes
            .replace(/\s*–\s*.*$/, '') // Remove everything after em-dash
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    isDateLine(line) {
        const trimmed = line.trim();
        const dateIndicators = [
            /^\d{4}$/,                              // Just a year (2025)
            /^[\d\s\-\/\.]+$/,                      // Only numbers and date separators
            /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/gi,  // Just day names
            /^(january|february|march|april|may|june|july|august|september|october|november|december)$/gi, // Just month names
            /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}$/gi, // Month + day
            /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}$/gi, // Full date format
            /^\d{1,2}[\/\.]\d{1,2}[\/\.]\d{2,4}$/, // Numeric date format
            /^\d{4}-\d{1,2}-\d{1,2}$/, // ISO date format
            /^(december|january|february|march|april|may|june|july|august|september|october|november)\s+\d{1,2},?\s*[-–]\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}$/gi // Date range
        ];
        
        const isDateOnly = dateIndicators.some(pattern => pattern.test(trimmed));
        
        if (isDateOnly) {
            console.log(`📅 Identified date-only line: "${trimmed}"`);
        }
        
        return isDateOnly;
    }

    isHeaderLine(line) {
        const headerIndicators = [
            /^(date|event|explanation|purpose|calendar|information)$/gi,
            /^[A-Z\s\-_]+$/, // All caps (likely headers) but allow dashes and underscores
            /^(new westminster )?school district( no\. \d+)?$/gi,
            /^lord kelvin elementary( \d{4}-\d{4})?$/gi,
            /^school calendar$/gi,
            /^calendar information$/gi,
            /^(2025|2026)$/gi, // Just year
            /^\d{4}-\d{4}$/gi // Year range like 2025-2026
        ];
        
        const trimmed = line.trim();
        const isHeader = headerIndicators.some(pattern => pattern.test(trimmed));
        
        if (isHeader) {
            console.log(`📋 Identified header: "${trimmed}"`);
        }
        
        return isHeader;
    }

    categorizeEvent(eventName) {
        const categories = {
            study: [
                'school', 'learning', 'education', 'homework', 'study', 'lesson', 'class', 
                'report card', 'pro-d', 'professional', 'instructional', 'collaboration',
                'בית ספר', 'לימוד', 'שיעור', 'דוח'
            ],
            outdoor: [
                'park', 'outdoor', 'sports', 'playground', 'field trip', 'day', 'walk',
                'פארק', 'חוץ', 'ספורט', 'טיול'
            ],
            museum: [
                'museum', 'exhibition', 'gallery', 'cultural', 'library', 'center',
                'מוזיאון', 'תערוכה', 'תרבות'
            ],
            routine: [
                'breakfast', 'lunch', 'dinner', 'sleep', 'bath', 'opening', 'closed',
                'break', 'reopen', 'dismiss', 'administration',
                'ארוחה', 'שינה', 'אמבטיה', 'פתיחה'
            ],
            special: [
                'birthday', 'holiday', 'celebration', 'festival', 'vacation', 'christmas', 'winter',
                'spring', 'thanksgiving', 'remembrance', 'day', 'shirt', 'photo', 'graduation',
                'easter', 'family', 'victoria', 'truth', 'reconciliation', 'multicultural',
                'welcome', 'ceremony', 'conference',
                'חג', 'יום הולדת', 'חופש', 'חגיגה'
            ]
        };

        const lowerName = eventName.toLowerCase();
        
        // Check each category
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => lowerName.includes(keyword.toLowerCase()))) {
                console.log(`🏷️ Categorized "${eventName}" as "${category}"`);
                return category;
            }
        }

        // Default categorization based on common school event patterns
        if (lowerName.includes('day') && !lowerName.includes('birthday')) {
            console.log(`🏷️ Categorized "${eventName}" as "special" (contains 'day')`);
            return 'special';
        }
        
        if (lowerName.includes('school') || lowerName.includes('class') || lowerName.includes('student')) {
            console.log(`🏷️ Categorized "${eventName}" as "study" (school-related)`);
            return 'study';
        }

        // Default to special for most imported events
        console.log(`🏷️ Categorized "${eventName}" as "special" (default)`);
        return 'special';
    }

    getDefaultParticipants(category) {
        // Most imported events (school calendar) affect the whole family
        return ['dad', 'mom', 'child1', 'child2'];
    }

    removeDuplicates(events) {
        const seen = new Map();
        const unique = [];
        
        for (const event of events) {
            const dateKey = event.date.toDateString();
            const eventKey = event.name.toLowerCase().trim();
            const combinedKey = `${dateKey}-${eventKey}`;
            
            // Check for exact duplicates
            if (seen.has(combinedKey)) {
                console.log(`🗑️ Removing exact duplicate: "${event.name}" on ${dateKey}`);
                continue;
            }
            
            // Check for similar events (fuzzy matching)
            let isDuplicate = false;
            for (const [existingKey, existingEvent] of seen.entries()) {
                if (existingKey.startsWith(dateKey)) {
                    const similarity = this.calculateSimilarity(eventKey, existingEvent.name.toLowerCase().trim());
                    if (similarity > 0.8) { // 80% similarity threshold
                        console.log(`🗑️ Removing similar duplicate: "${event.name}" (${similarity.toFixed(2)} similarity with "${existingEvent.name}")`);
                        isDuplicate = true;
                        break;
                    }
                }
            }
            
            if (!isDuplicate) {
                seen.set(combinedKey, event);
                unique.push(event);
                console.log(`✅ Keeping unique event: "${event.name}" on ${dateKey}`);
            }
        }
        
        console.log(`🧹 Duplicate removal: ${events.length} → ${unique.length} events`);
        return unique;
    }

    // NEW: Calculate string similarity (Levenshtein distance based)
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) {
            return 1.0;
        }
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // NEW: Calculate Levenshtein distance
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Format events for preview
    formatEventsForPreview() {
        return this.parsedEvents.map(event => ({
            date: event.date.toISOString().split('T')[0],
            dateDisplay: event.date.toLocaleDateString('he-IL'),
            name: event.name,
            category: event.category,
            participants: event.participants,
            timeSlot: event.timeSlot
        }));
    }

    // Get date range of events
    getDateRange() {
        if (this.parsedEvents.length === 0) return null;
        
        const dates = this.parsedEvents.map(event => event.date);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        return {
            start: minDate.toLocaleDateString('he-IL'),
            end: maxDate.toLocaleDateString('he-IL'),
            count: this.parsedEvents.length
        };
    }

    // Filter events based on options
    filterEvents(options = {}) {
        let filtered = [...this.parsedEvents];

        if (options.skipWeekends) {
            filtered = filtered.filter(event => {
                const day = event.date.getDay();
                return day !== 0 && day !== 6; // Not Sunday or Saturday
            });
        }

        if (options.startDate) {
            const start = new Date(options.startDate);
            filtered = filtered.filter(event => event.date >= start);
        }

        if (options.endDate) {
            const end = new Date(options.endDate);
            filtered = filtered.filter(event => event.date <= end);
        }

        return filtered;
    }

    // Apply customization options to events
    applyCustomization(options) {
        this.parsedEvents.forEach(event => {
            if (options.defaultCategory) {
                event.category = options.defaultCategory;
            }
            
            if (options.participants && options.participants.length > 0) {
                event.participants = options.participants;
            }
            
            if (options.createAllDay) {
                event.timeSlot = '09:00-17:00';
            }
        });
    }

    // Get current step progress
    getStepProgress() {
        return {
            current: this.currentStep,
            max: this.maxSteps,
            percentage: (this.currentStep / this.maxSteps) * 100
        };
    }

    // NEW: Get raw text for debugging
    getRawText() {
        return this.rawText || '';
    }

    // NEW: Debug function to analyze text patterns
    debugTextPatterns() {
        if (!this.rawText) {
            console.log('❌ No raw text available for analysis');
            return;
        }
        
        console.log('🔍 DEBUG: Analyzing text patterns...');
        
        const lines = this.rawText.split('\n').filter(line => line.trim());
        console.log(`📊 Total lines: ${lines.length}`);
        
        // Show first 20 lines for manual inspection
        console.log('📝 First 20 lines of PDF:');
        lines.slice(0, 20).forEach((line, index) => {
            console.log(`   ${(index + 1).toString().padStart(2, '0')}. "${line.trim()}"`);
        });
        
        // Find potential date lines with various patterns
        const datePatterns = [
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
            /\b\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}\b/g,
            /\b(2025|2026)\b/g
        ];
        
        console.log('\n📅 Lines containing potential date indicators:');
        let dateLineCount = 0;
        
        lines.forEach((line, index) => {
            let hasDatePattern = false;
            datePatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    hasDatePattern = true;
                }
                pattern.lastIndex = 0; // Reset for next test
            });
            
            if (hasDatePattern) {
                dateLineCount++;
                console.log(`   📅 Line ${index + 1}: "${line.trim()}"`);
                
                // Try to extract date from this line specifically
                const testDate = this.extractDateFromLine(line, [
                    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/gi,
                    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/gi,
                    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/gi
                ], {}, {
                    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
                    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12
                }, 2025);
                
                if (testDate) {
                    console.log(`     ✅ Successfully parsed: ${testDate.toLocaleDateString()}`);
                } else {
                    console.log(`     ❌ Could not parse date from this line`);
                }
            }
        });
        
        console.log(`\n📊 Summary: Found ${dateLineCount} lines with potential date patterns`);
        
        // Find lines with common event words
        const eventWords = ['school', 'day', 'break', 'holiday', 'conference', 'photo', 'report', 'opening', 'closed', 'card'];
        const eventLines = [];
        
        lines.forEach((line, index) => {
            const lowerLine = line.toLowerCase();
            if (eventWords.some(word => lowerLine.includes(word))) {
                eventLines.push({index: index + 1, line: line.trim()});
            }
        });
        
        console.log(`\n🎯 Lines containing potential event words (first 15):`);
        eventLines.slice(0, 15).forEach(item => {
            console.log(`   🎯 Line ${item.index}: "${item.line}"`);
        });
        
        console.log(`\n📊 Total event-related lines found: ${eventLines.length}`);
        
        // Specific analysis for school calendar format
        console.log('\n📚 School calendar format analysis:');
        const schoolPatterns = [
            /school\s+(opening|closed|reopen)/gi,
            /(pro-d|professional|instructional)/gi,
            /(report\s+card|dismissal|conference)/gi,
            /(holiday|break|vacation)/gi
        ];
        
        let schoolEventCount = 0;
        lines.forEach((line, index) => {
            let hasSchoolPattern = false;
            schoolPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    hasSchoolPattern = true;
                    schoolEventCount++;
                    console.log(`   🏫 School event line ${index + 1}: "${line.trim()}"`);
                }
                pattern.lastIndex = 0;
            });
        });
        
        console.log(`\n📊 Total school-specific events found: ${schoolEventCount}`);
        
        // Final recommendation
        if (dateLineCount === 0) {
            console.log('\n❌ ISSUE: No date patterns found. The PDF might not contain dates in supported formats.');
        } else if (eventLines.length === 0) {
            console.log('\n❌ ISSUE: No event words found. The PDF might not contain event descriptions.');
        } else {
            console.log('\n✅ Both dates and events were found. The parsing algorithm might need fine-tuning for this specific format.');
        }
    }

    // Set current step
    setStep(step) {
        this.currentStep = Math.max(1, Math.min(step, this.maxSteps));
    }

    // Move to next step
    nextStep() {
        if (this.currentStep < this.maxSteps) {
            this.currentStep++;
        }
        return this.currentStep;
    }

    // Move to previous step
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
        return this.currentStep;
    }
}

// Create global instance
window.pdfEventParser = new PDFEventParser();

// Export for use in other modules
export { PDFEventParser };
