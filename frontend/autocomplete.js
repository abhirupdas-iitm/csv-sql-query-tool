class SQLAutocomplete {
    constructor(textareaId) {
        this.textarea = document.getElementById(textareaId);
        if (!this.textarea) return;

        this.keywords = [
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 
            'CREATE', 'TABLE', 'DROP', 'ALTER', 'ADD', 'COLUMN', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 
            'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'AND', 'OR', 
            'NOT', 'NULL', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'UNIQUE', 'CHECK', 'INDEX'
        ];
        this.tables = [];
        this.suggestions = [];
        this.selectedIndex = -1;
        this.isActive = false;
        
        this.initDropdown();
        this.attachEvents();
    }

    setTables(tables) {
        this.tables = tables;
    }

    initDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'autocomplete-menu hidden';
        document.body.appendChild(this.dropdown);
    }

    attachEvents() {
        this.textarea.addEventListener('input', this.handleInput.bind(this));
        this.textarea.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.textarea.addEventListener('scroll', () => {
            if (this.isActive) this.updateDropdownPosition();
        });
        document.addEventListener('click', (e) => {
            if (e.target !== this.textarea && !this.dropdown.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    // A lightweight helper to get textarea cursor coordinates
    getCaretCoordinates() {
        const ta = this.textarea;
        // Create a hidden div that mimics the textarea's style
        const div = document.createElement('div');
        const computed = window.getComputedStyle(ta);
        
        const properties = [
            'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
            'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
            'lineHeight', 'fontFamily', 'textAlign', 'textTransform', 'textIndent',
            'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize'
        ];
        
        properties.forEach(prop => {
            div.style[prop] = computed[prop];
        });
        
        div.style.position = 'absolute';
        div.style.top = '0px';
        div.style.left = '-9999px';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordWrap = 'break-word';
        
        // Add text up to the cursor
        const textBeforeCursor = ta.value.substring(0, ta.selectionEnd);
        div.textContent = textBeforeCursor;
        
        // Add a marker span
        const span = document.createElement('span');
        span.textContent = ta.value.substring(ta.selectionEnd) || '.'; 
        div.appendChild(span);
        
        document.body.appendChild(div);
        
        const taRect = ta.getBoundingClientRect();
        
        // Calculate coordinates relative to viewport
        const coords = {
            top: taRect.top + span.offsetTop - ta.scrollTop + parseInt(computed.borderTopWidth),
            left: taRect.left + span.offsetLeft - ta.scrollLeft + parseInt(computed.borderLeftWidth),
            height: parseInt(computed.lineHeight) || span.offsetHeight
        };
        
        document.body.removeChild(div);
        return coords;
    }

    getCurrentWord() {
        const text = this.textarea.value;
        const cursor = this.textarea.selectionEnd;
        
        // Find the start of the word before cursor
        let start = cursor;
        while (start > 0 && /[\w]/.test(text[start - 1])) {
            start--;
        }
        
        // Return the word and its position
        return {
            word: text.substring(start, cursor),
            start: start,
            end: cursor
        };
    }

    handleInput(e) {
        const { word } = this.getCurrentWord();
        
        if (!word || word.length < 1) {
            this.hideDropdown();
            return;
        }

        const matchWord = word.toUpperCase();
        
        // Collect suggestions
        const matchedKeywords = this.keywords.filter(k => k.startsWith(matchWord)).map(k => ({ text: k, type: 'keyword' }));
        const matchedTables = this.tables.filter(t => t.toUpperCase().startsWith(matchWord)).map(t => ({ text: `"${t}"`, type: 'table' }));
        
        this.suggestions = [...matchedTables, ...matchedKeywords].slice(0, 8); // Max 8 suggestions
        
        if (this.suggestions.length > 0) {
            this.selectedIndex = 0;
            this.showDropdown();
        } else {
            this.hideDropdown();
        }
    }

    handleKeyDown(e) {
        if (!this.isActive) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.suggestions.length;
                this.renderDropdown();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.suggestions.length) % this.suggestions.length;
                this.renderDropdown();
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                this.insertSuggestion();
                break;
            case 'Escape':
                e.preventDefault();
                this.hideDropdown();
                break;
        }
    }

    updateDropdownPosition() {
        const coords = this.getCaretCoordinates();
        this.dropdown.style.top = `${coords.top + coords.height + 4}px`;
        this.dropdown.style.left = `${coords.left}px`;
    }

    showDropdown() {
        this.isActive = true;
        this.dropdown.classList.remove('hidden');
        this.updateDropdownPosition();
        this.renderDropdown();
    }

    hideDropdown() {
        this.isActive = false;
        this.dropdown.classList.add('hidden');
        this.suggestions = [];
        this.selectedIndex = -1;
    }

    renderDropdown() {
        this.dropdown.innerHTML = '';
        this.suggestions.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = `autocomplete-item ${index === this.selectedIndex ? 'active' : ''}`;
            
            // Icon based on type
            const icon = item.type === 'table' ? '📁' : '🔑';
            div.innerHTML = `<span style="font-size:10px; margin-right:5px; opacity:0.7;">${icon}</span> ${item.text}`;
            
            div.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Prevent blur of textarea
                this.selectedIndex = index;
                this.insertSuggestion();
            });
            
            this.dropdown.appendChild(div);
        });
    }

    insertSuggestion() {
        if (this.selectedIndex < 0 || this.selectedIndex >= this.suggestions.length) return;
        
        const suggestion = this.suggestions[this.selectedIndex].text;
        const { start, end } = this.getCurrentWord();
        const text = this.textarea.value;
        
        // Replace current word with suggestion
        this.textarea.value = text.substring(0, start) + suggestion + ' ' + text.substring(end);
        
        // Move cursor after inserted word
        const newCursorPos = start + suggestion.length + 1;
        this.textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        this.hideDropdown();
        
        // Trigger input event to sync editor
        this.textarea.dispatchEvent(new Event('input', { bubbles: true }));
        if(window.syncEditor) window.syncEditor();
    }
}

// Global instance to be initialized in script.js
window.SQLAutocomplete = SQLAutocomplete;
