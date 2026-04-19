class MythIndexApp {
    constructor() {
        this.token = localStorage.getItem('mythindex_token');
        this.currentUser = JSON.parse(localStorage.getItem('mythindex_user') || 'null');
        this.worlds = [];
        this.currentWorld = null;
        this.pages = [];
        this.currentPage = null;
        this.expandedPages = new Set();
        this.autoSaveTimeout = null;
        this.commandMenu = null;
        this.currentBlock = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        if (this.token && this.currentUser) {
            this.showApp();
            this.loadWorlds();
        } else {
            this.showAuth();
        }
    }
    
    setupEventListeners() {
        // Auth
        document.getElementById('loginTab').addEventListener('click', () => this.showLoginTab());
        document.getElementById('registerTab').addEventListener('click', () => this.showRegisterTab());
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
        
        // App controls
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('worldSelector').addEventListener('click', () => this.showWorldPicker());
        document.getElementById('newPageBtn').addEventListener('click', () => this.addPage());
        document.getElementById('searchBtn').addEventListener('click', () => this.showSearch());
        document.getElementById('propertiesToggle').addEventListener('click', () => this.toggleProperties());
        
        // Modals
        document.getElementById('closeWorldPicker').addEventListener('click', () => this.hideWorldPicker());
        document.getElementById('createNewWorldBtn').addEventListener('click', () => this.showCreateWorld());
        document.getElementById('createWorldForm').addEventListener('submit', (e) => this.handleCreateWorld(e));
        document.getElementById('cancelCreateWorld').addEventListener('click', () => this.hideCreateWorld());
        document.getElementById('closeSearch').addEventListener('click', () => this.hideSearch());
        document.getElementById('closeIconPicker').addEventListener('click', () => this.hideIconPicker());
        document.getElementById('closeProperties').addEventListener('click', () => this.hideProperties());
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Icon picker
        document.getElementById('iconSearch').addEventListener('input', (e) => this.filterIcons(e.target.value));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Page icon
        document.getElementById('pageIcon').addEventListener('click', () => this.showPageIconPicker());
        
        // Page title
        document.getElementById('pageTitle').addEventListener('input', (e) => this.handleTitleChange(e.target.textContent));
        
        // Add block button
        document.getElementById('addBlockBtn').addEventListener('click', () => this.insertNewBlock(this.currentPage?.content?.length || 0));
        
        // View toggle
        document.getElementById('viewToggle').addEventListener('click', () => this.toggleView());
        
        // More options
        document.getElementById('moreOptions').addEventListener('click', () => this.showMoreOptions());
        
        // Relationship map modal
        document.getElementById('closeRelationshipMap').addEventListener('click', () => this.hideRelationshipMap());
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomInMap());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOutMap());
        document.getElementById('fitMap').addEventListener('click', () => this.fitMapToView());
    }
    
    showLoginTab() {
        document.getElementById('loginTab').classList.add('border-dark-accent', 'text-dark-accent');
        document.getElementById('loginTab').classList.remove('text-dark-secondary');
        document.getElementById('registerTab').classList.remove('border-dark-accent', 'text-dark-accent');
        document.getElementById('registerTab').classList.add('text-dark-secondary');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    }
    
    showRegisterTab() {
        document.getElementById('registerTab').classList.add('border-dark-accent', 'text-dark-accent');
        document.getElementById('registerTab').classList.remove('text-dark-secondary');
        document.getElementById('loginTab').classList.remove('border-dark-accent', 'text-dark-accent');
        document.getElementById('loginTab').classList.add('text-dark-secondary');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
    }
    
    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('mythindex_token', this.token);
                localStorage.setItem('mythindex_user', JSON.stringify(this.currentUser));
                this.showApp();
                this.loadWorlds();
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (error) {
            this.showToast('Connection error', 'error');
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.token = data.token;
                this.currentUser = data.user;
                localStorage.setItem('mythindex_token', this.token);
                localStorage.setItem('mythindex_user', JSON.stringify(this.currentUser));
                this.showApp();
                this.loadWorlds();
            } else {
                this.showToast(data.error, 'error');
            }
        } catch (error) {
            this.showToast('Connection error', 'error');
        }
    }
    
    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('mythindex_token');
        localStorage.removeItem('mythindex_user');
        this.showAuth();
    }
    
    showAuth() {
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }
    
    showApp() {
        document.getElementById('authModal').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('username').textContent = this.currentUser.username;
    }
    
    async loadWorlds() {
        try {
            const response = await fetch('/worlds', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.worlds = await response.json();
                this.updateWorldSelector();
                
                if (this.worlds.length === 0) {
                    this.showEmptyState();
                }
            } else if (response.status === 401) {
                this.logout();
            }
        } catch (error) {
            this.showToast('Failed to load worlds', 'error');
        }
    }
    
    updateWorldSelector() {
        const worldName = document.getElementById('currentWorldName');
        if (this.currentWorld) {
            worldName.textContent = this.currentWorld.name;
        } else {
            worldName.textContent = 'Select World';
        }
    }
    
    showWorldPicker() {
        document.getElementById('worldPickerModal').classList.remove('hidden');
        const worldList = document.getElementById('worldList');
        worldList.innerHTML = '';
        
        this.worlds.forEach(world => {
            const card = document.createElement('div');
            card.className = 'bg-dark-bg border border-dark-border rounded-lg p-4 cursor-pointer hover:border-dark-accent transition';
            card.innerHTML = `
                <div class="h-2 bg-${world.cover_color || 'dark-accent'} rounded-t-md -m-4 mb-3"></div>
                <h3 class="font-bold mb-1">${world.name}</h3>
                <p class="text-sm text-dark-secondary mb-2">${world.description || 'No description'}</p>
                <div class="flex items-center justify-between text-xs text-dark-muted">
                    <span>${world.genre || 'No genre'}</span>
                    <span>${world.owner_username}</span>
                </div>
            `;
            card.addEventListener('click', () => this.openWorld(world.id));
            worldList.appendChild(card);
        });
    }
    
    hideWorldPicker() {
        document.getElementById('worldPickerModal').classList.add('hidden');
    }
    
    async openWorld(worldId) {
        this.currentWorld = this.worlds.find(w => w.id === worldId);
        this.updateWorldSelector();
        this.hideWorldPicker();
        
        // Update page title
        document.title = `${this.currentWorld.name} | MythIndex`;
        
        await this.loadPages();
        this.showWorldOverview();
    }
    
    async loadPages() {
        if (!this.currentWorld) return;
        
        try {
            const response = await fetch(`/worlds/${this.currentWorld.id}/pages`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.pages = await response.json();
                this.renderSidebar();
            }
        } catch (error) {
            this.showToast('Failed to load pages', 'error');
        }
    }
    
    renderSidebar() {
        const pageTree = document.getElementById('pageTree');
        pageTree.innerHTML = '';
        
        // Build tree structure
        const rootPages = this.pages.filter(p => !p.parent_id);
        rootPages.forEach(page => {
            pageTree.appendChild(this.createPageNode(page));
        });
    }
    
    createPageNode(page, level = 0) {
        const node = document.createElement('div');
        node.className = 'page-node';
        
        const pageItem = document.createElement('div');
        pageItem.className = `flex items-center space-x-2 p-2 rounded hover:bg-dark-bg cursor-pointer transition ${this.currentPage?.id === page.id ? 'bg-dark-bg border-l-2 border-dark-accent' : ''}`;
        pageItem.style.paddingLeft = `${level * 12 + 8}px`;
        
        // Expand/collapse for pages with children
        const children = this.pages.filter(p => p.parent_id === page.id);
        const hasChildren = children.length > 0;
        
        const icon = document.createElement('div');
        icon.className = `w-6 h-6 bg-${this.getPageTypeColor(page.page_type)} rounded flex items-center justify-center`;
        icon.innerHTML = `<i class="${this.getPageTypeIcon(page.page_type)} text-white text-xs"></i>`;
        pageItem.appendChild(icon);
        
        // Page title
        const title = document.createElement('span');
        title.className = 'flex-1 text-sm';
        title.textContent = page.title;
        pageItem.appendChild(title);
        
        // Page type badge (small)
        const typeBadge = document.createElement('span');
        typeBadge.className = 'text-xs px-1 py-0.5 bg-dark-bg rounded text-dark-secondary';
        typeBadge.textContent = this.getPageTypeLabel(page.page_type).charAt(0);
        pageItem.appendChild(typeBadge);
        
        // Page actions
        const actions = document.createElement('div');
        actions.className = 'hidden group-hover:flex items-center space-x-1';
        
        const addBtn = document.createElement('button');
        addBtn.className = 'text-xs text-dark-secondary hover:text-dark-text';
        addBtn.innerHTML = '<i class="fas fa-plus"></i>';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addPage(page.id);
        });
        
        const moreBtn = document.createElement('button');
        moreBtn.className = 'text-xs text-dark-secondary hover:text-dark-text';
        moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPageMenu(page, e);
        });
        
        actions.appendChild(addBtn);
        actions.appendChild(moreBtn);
        pageItem.appendChild(actions);
        
        pageItem.addEventListener('mouseenter', () => actions.classList.remove('hidden'));
        pageItem.addEventListener('mouseleave', () => actions.classList.add('hidden'));
        pageItem.addEventListener('click', () => this.openPage(page.id));
        
        node.appendChild(pageItem);
        
        // Add child pages
        const childPages = this.pages.filter(p => p.parent_id === page.id);
        childPages.forEach(child => {
            node.appendChild(this.createPageNode(child, level + 1));
        });
        
        return node;
    }
    
    togglePageExpand(pageId) {
        if (this.expandedPages.has(pageId)) {
            this.expandedPages.delete(pageId);
        } else {
            this.expandedPages.add(pageId);
        }
        this.renderSidebar();
    }
    
    showPageMenu(page, event) {
        // Simple context menu implementation
        const menu = document.createElement('div');
        menu.className = 'fixed bg-dark-card border border-dark-border rounded-lg shadow-lg z-50 py-1';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        
        const items = [
            { label: 'Rename', action: () => this.renamePage(page) },
            { label: 'Change Type', action: () => this.showPageTypePicker(page) },
            { label: 'Delete', action: () => this.deletePage(page.id) }
        ];
        
        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'px-4 py-2 text-sm hover:bg-dark-bg cursor-pointer';
            menuItem.textContent = item.label;
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 100);
    }
    
    renamePage(page) {
        const newTitle = prompt('Enter new title:', page.title);
        if (newTitle && newTitle !== page.title) {
            this.updatePage(page.id, { title: newTitle });
        }
    }
    
    showPageTypePicker(page) {
        const types = [
            { value: 'document', label: 'Document', icon: 'fas fa-file-alt' },
            { value: 'character', label: 'Character', icon: 'fas fa-user' },
            { value: 'location', label: 'Location', icon: 'fas fa-map-marker-alt' },
            { value: 'lore', label: 'Lore', icon: 'fas fa-book' },
            { value: 'faction', label: 'Faction', icon: 'fas fa-users' },
            { value: 'item', label: 'Item', icon: 'fas fa-gem' },
            { value: 'timeline', label: 'Timeline', icon: 'fas fa-clock' }
        ];
        
        const type = prompt('Select page type:\n' + types.map((t, i) => `${i + 1}. ${t.label}`).join('\n'));
        
        if (type && types[parseInt(type) - 1]) {
            this.updatePage(page.id, { page_type: types[parseInt(type) - 1].value });
        }
    }
    
    async addPage(parentId = null, template = null) {
        if (!this.currentWorld) return;
        
        try {
            const pageData = {
                title: 'Untitled',
                page_type: template?.page_type || 'document',
                parent_id: parentId,
                properties: template?.default_properties || {}
            };
            
            const response = await fetch(`/worlds/${this.currentWorld.id}/pages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pageData)
            });
            
            if (response.ok) {
                const newPage = await response.json();
                this.pages.push(newPage);
                this.renderSidebar();
                this.openPage(newPage.id);
                
                // Apply template content if provided
                if (template?.default_blocks?.length > 0) {
                    this.updatePage(newPage.id, { content: template.default_blocks });
                }
            }
        } catch (error) {
            this.showToast('Failed to create page', 'error');
        }
    }
    
    async deletePage(pageId) {
        if (!confirm('Are you sure you want to delete this page?')) return;
        
        try {
            const response = await fetch(`/pages/${pageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.pages = this.pages.filter(p => p.id !== pageId);
                this.renderSidebar();
                if (this.currentPage?.id === pageId) {
                    this.currentPage = null;
                    this.showWorldOverview();
                }
            }
        } catch (error) {
            this.showToast('Failed to delete page', 'error');
        }
    }
    
    async openPage(pageId) {
        try {
            const response = await fetch(`/pages/${pageId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                this.currentPage = await response.json();
                this.renderSidebar(); // Update active state
                this.showPageEditor();
            }
        } catch (error) {
            this.showToast('Failed to load page', 'error');
        }
    }
    
    showWorldOverview() {
        document.getElementById('worldOverview').classList.remove('hidden');
        document.getElementById('pageEditor').classList.add('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        
        if (!this.currentWorld) return;
        
        const overview = document.getElementById('worldOverview');
        const characters = this.pages.filter(p => p.page_type === 'character').length;
        const locations = this.pages.filter(p => p.page_type === 'location').length;
        const lore = this.pages.filter(p => p.page_type === 'lore').length;
        const factions = this.pages.filter(p => p.page_type === 'faction').length;
        const items = this.pages.filter(p => p.page_type === 'item').length;
        const timelines = this.pages.filter(p => p.page_type === 'timeline').length;
        const totalPages = this.pages.length;
        
        overview.innerHTML = `
            <div class="worldbuilding-header text-white">
                <div class="flex items-center space-x-6">
                    <div class="w-20 h-20 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                        <span class="text-3xl font-bold">${this.currentWorld.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                        <h1 class="text-3xl font-bold mb-2">${this.currentWorld.name}</h1>
                        <p class="text-lg opacity-90">${this.currentWorld.description || 'No description'}</p>
                        <div class="flex items-center space-x-4 mt-3 text-sm opacity-80">
                            <span><i class="fas fa-tag mr-1"></i>${this.currentWorld.genre || 'No genre'}</span>
                            <span><i class="fas fa-palette mr-1"></i>${this.currentWorld.tone || 'No tone'}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="world-stats">
                <div class="world-stat-card">
                    <div class="world-stat-number">${totalPages}</div>
                    <div class="world-stat-label">Total Pages</div>
                </div>
                <div class="world-stat-card">
                    <div class="world-stat-number">${characters}</div>
                    <div class="world-stat-label">Characters</div>
                </div>
                <div class="world-stat-card">
                    <div class="world-stat-number">${locations}</div>
                    <div class="world-stat-label">Locations</div>
                </div>
                <div class="world-stat-card">
                    <div class="world-stat-number">${lore}</div>
                    <div class="world-stat-label">Lore Entries</div>
                </div>
                <div class="world-stat-card">
                    <div class="world-stat-number">${factions}</div>
                    <div class="world-stat-label">Factions</div>
                </div>
                <div class="world-stat-card">
                    <div class="world-stat-number">${items}</div>
                    <div class="world-stat-label">Items</div>
                </div>
                <div class="world-stat-card">
                    <div class="world-stat-number">${timelines}</div>
                    <div class="world-stat-label">Timelines</div>
                </div>
            </div>
            
            <div class="mb-8">
                <h2 class="text-2xl font-bold mb-4">Quick Create</h2>
                <div class="page-type-grid">
                    <div onclick="app.addPage(null, {page_type: 'character', default_properties: {name: '', age: '', gender: '', race: '', class: '', alignment: '', status: 'alive'}})" class="page-type-card">
                        <div class="page-type-icon-container bg-blue-600">
                            <i class="fas fa-user text-white text-xl"></i>
                        </div>
                        <div class="page-type-name">Character</div>
                        <div class="page-type-description">Create detailed character profiles</div>
                    </div>
                    <div onclick="app.addPage(null, {page_type: 'location', default_properties: {type: '', climate: '', population: '', government: '', status: 'active'}})" class="page-type-card">
                        <div class="page-type-icon-container bg-green-600">
                            <i class="fas fa-map-marker-alt text-white text-xl"></i>
                        </div>
                        <div class="page-type-name">Location</div>
                        <div class="page-type-description">Document places and regions</div>
                    </div>
                    <div onclick="app.addPage(null, {page_type: 'lore', default_properties: {category: '', era: '', importance: ''}})" class="page-type-card">
                        <div class="page-type-icon-container bg-purple-600">
                            <i class="fas fa-book text-white text-xl"></i>
                        </div>
                        <div class="page-type-name">Lore Entry</div>
                        <div class="page-type-description">Record history and mythology</div>
                    </div>
                    <div onclick="app.addPage(null, {page_type: 'faction', default_properties: {type: '', alignment: '', size: '', leader: '', goal: ''}})" class="page-type-card">
                        <div class="page-type-icon-container bg-red-600">
                            <i class="fas fa-users text-white text-xl"></i>
                        </div>
                        <div class="page-type-name">Faction</div>
                        <div class="page-type-description">Organize groups and organizations</div>
                    </div>
                    <div onclick="app.addPage(null, {page_type: 'item', default_properties: {type: '', rarity: '', magic: '', owner: ''}})" class="page-type-card">
                        <div class="page-type-icon-container bg-yellow-600">
                            <i class="fas fa-gem text-white text-xl"></i>
                        </div>
                        <div class="page-type-name">Item</div>
                        <div class="page-type-description">Catalog artifacts and equipment</div>
                    </div>
                    <div onclick="app.addPage(null, {page_type: 'timeline', default_properties: {era: '', period: '', events: []}})" class="page-type-card">
                        <div class="page-type-icon-container bg-indigo-600">
                            <i class="fas fa-clock text-white text-xl"></i>
                        </div>
                        <div class="page-type-name">Timeline</div>
                        <div class="page-type-description">Track historical events</div>
                    </div>
                    <div onclick="app.addPage()" class="page-type-card">
                        <div class="page-type-icon-container bg-gray-600">
                            <i class="fas fa-file-alt text-white text-xl"></i>
                        </div>
                        <div class="page-type-name">Document</div>
                        <div class="page-type-description">Free-form content</div>
                    </div>
                </div>
            </div>
            
            ${this.pages.length > 0 ? `
                <div>
                    <h2 class="text-2xl font-bold mb-4">Recent Pages</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${this.pages.slice(0, 6).map(page => `
                            <div onclick="app.openPage(${page.id})" class="bg-dark-bg border border-dark-border rounded-lg p-4 hover:border-dark-accent cursor-pointer transition">
                                <div class="flex items-center space-x-3 mb-3">
                                    <div class="w-10 h-10 bg-${this.getPageTypeColor(page.page_type)} rounded-lg flex items-center justify-center">
                                        <i class="${this.getPageTypeIcon(page.page_type)} text-white text-sm"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="font-medium">${page.title}</div>
                                        <div class="text-xs text-dark-secondary">${this.getPageTypeLabel(page.page_type)}</div>
                                    </div>
                                </div>
                                <p class="text-sm text-dark-secondary line-clamp-2">${page.properties?.description || 'No description'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }
    
    getPageTypeLabel(type) {
        const labels = {
            character: 'Character',
            location: 'Location',
            lore: 'Lore',
            faction: 'Faction',
            item: 'Item',
            timeline: 'Timeline',
            document: 'Document'
        };
        return labels[type] || 'Document';
    }
    
    getPageTypeIcon(type) {
        const icons = {
            character: 'fas fa-user',
            location: 'fas fa-map-marker-alt',
            lore: 'fas fa-book',
            faction: 'fas fa-users',
            item: 'fas fa-gem',
            timeline: 'fas fa-clock',
            document: 'fas fa-file-alt'
        };
        return icons[type] || 'fas fa-file-alt';
    }
    
    getCalloutClass(type) {
        const classes = {
            info: 'bg-blue-500',
            warning: 'bg-yellow-500',
            tip: 'bg-green-500',
            lore: 'bg-purple-500',
            danger: 'bg-red-500'
        };
        return classes[type] || 'bg-blue-500';
    }
    
    createCharacterCard(block) {
        const card = document.createElement('div');
        card.className = 'bg-dark-bg border border-dark-border rounded-lg p-6 mb-2';
        card.innerHTML = `
            <div class="flex items-start space-x-4">
                <div class="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                    <i class="fas fa-user text-white text-2xl"></i>
                </div>
                <div class="flex-1">
                    <h3 class="text-xl font-bold mb-2" contenteditable="true">${block.content?.name || 'Character Name'}</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Age:</strong> <span contenteditable="true">${block.content?.age || ''}</span></div>
                        <div><strong>Gender:</strong> <span contenteditable="true">${block.content?.gender || ''}</span></div>
                        <div><strong>Race:</strong> <span contenteditable="true">${block.content?.race || ''}</span></div>
                        <div><strong>Class:</strong> <span contenteditable="true">${block.content?.class || ''}</span></div>
                    </div>
                    <div class="mt-4">
                        <strong>Description:</strong>
                        <p class="mt-2 text-dark-secondary" contenteditable="true">${block.content?.description || ''}</p>
                    </div>
                </div>
            </div>
        `;
        return card;
    }
    
    createLocationPin(block) {
        const pin = document.createElement('div');
        pin.className = 'bg-dark-bg border border-dark-border rounded-lg p-6 mb-2';
        pin.innerHTML = `
            <div class="flex items-start space-x-4">
                <div class="w-16 h-16 bg-green-700 rounded-lg flex items-center justify-center">
                    <i class="fas fa-map-marker-alt text-white text-2xl"></i>
                </div>
                <div class="flex-1">
                    <h3 class="text-xl font-bold mb-2" contenteditable="true">${block.content?.name || 'Location Name'}</h3>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Type:</strong> <span contenteditable="true">${block.content?.type || ''}</span></div>
                        <div><strong>Climate:</strong> <span contenteditable="true">${block.content?.climate || ''}</span></div>
                        <div><strong>Population:</strong> <span contenteditable="true">${block.content?.population || ''}</span></div>
                        <div><strong>Government:</strong> <span contenteditable="true">${block.content?.government || ''}</span></div>
                    </div>
                    <div class="mt-4">
                        <strong>Description:</strong>
                        <p class="mt-2 text-dark-secondary" contenteditable="true">${block.content?.description || ''}</p>
                    </div>
                </div>
            </div>
        `;
        return pin;
    }
    
    createTimelineEntry(block) {
        const entry = document.createElement('div');
        entry.className = 'bg-dark-bg border border-dark-border rounded-lg p-6 mb-2';
        entry.innerHTML = `
            <div class="flex items-start space-x-4">
                <div class="w-16 h-16 bg-indigo-700 rounded-lg flex items-center justify-center">
                    <i class="fas fa-clock text-white text-2xl"></i>
                </div>
                <div class="flex-1">
                    <div class="flex items-center space-x-4 mb-2">
                        <h3 class="text-xl font-bold" contenteditable="true">${block.content?.title || 'Timeline Event'}</h3>
                        <span class="px-2 py-1 bg-indigo-600 rounded text-sm" contenteditable="true">${block.content?.date || 'Date'}</span>
                    </div>
                    <div class="text-sm text-dark-secondary mb-2">
                        <strong>Era:</strong> <span contenteditable="true">${block.content?.era || ''}</span>
                    </div>
                    <div>
                        <strong>Description:</strong>
                        <p class="mt-2 text-dark-secondary" contenteditable="true">${block.content?.description || ''}</p>
                    </div>
                    ${block.content?.related_pages ? `
                        <div class="mt-4">
                            <strong>Related Pages:</strong>
                            <div class="flex flex-wrap gap-2 mt-2">
                                ${block.content.related_pages.map(pageId => 
                                    `<span class="px-2 py-1 bg-gray-700 rounded text-sm">Page ${pageId}</span>`
                                ).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        return entry;
    }
    
    createRelationshipMap(block) {
        const map = document.createElement('div');
        map.className = 'bg-dark-bg border border-dark-border rounded-lg p-6 mb-2';
        map.innerHTML = `
            <div class="flex items-center space-x-4 mb-4">
                <div class="w-12 h-12 bg-red-700 rounded-lg flex items-center justify-center">
                    <i class="fas fa-project-diagram text-white"></i>
                </div>
                <h3 class="text-xl font-bold">Relationship Map</h3>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="font-medium mb-2">Characters</h4>
                    <div class="space-y-2" id="relationship-characters">
                        ${block.content?.characters?.map((char, i) => 
                            `<div class="flex items-center space-x-2">
                                <input type="text" value="${char.name}" class="flex-1 px-2 py-1 bg-dark-card border border-dark-border rounded text-sm" placeholder="Character name">
                                <button onclick="app.removeRelationshipCharacter(${i})" class="p-1 hover:bg-dark-border rounded">
                                    <i class="fas fa-times text-xs"></i>
                                </button>
                            </div>`
                        ).join('') || '<div class="text-dark-secondary text-sm">No characters added</div>'}
                    </div>
                    <button onclick="app.addRelationshipCharacter()" class="mt-2 px-3 py-1 bg-dark-accent rounded text-sm">Add Character</button>
                </div>
                <div>
                    <h4 class="font-medium mb-2">Relationships</h4>
                    <div class="space-y-2" id="relationship-connections">
                        ${block.content?.relationships?.map((rel, i) => 
                            `<div class="flex items-center space-x-2">
                                <input type="text" value="${rel.from}" class="flex-1 px-2 py-1 bg-dark-card border border-dark-border rounded text-sm" placeholder="From">
                                <span>→</span>
                                <input type="text" value="${rel.to}" class="flex-1 px-2 py-1 bg-dark-card border border-dark-border rounded text-sm" placeholder="To">
                                <input type="text" value="${rel.type}" class="px-2 py-1 bg-dark-card border border-dark-border rounded text-sm" placeholder="Type">
                                <button onclick="app.removeRelationshipConnection(${i})" class="p-1 hover:bg-dark-border rounded">
                                    <i class="fas fa-times text-xs"></i>
                                </button>
                            </div>`
                        ).join('') || '<div class="text-dark-secondary text-sm">No relationships defined</div>'}
                    </div>
                    <button onclick="app.addRelationshipConnection()" class="mt-2 px-3 py-1 bg-dark-accent rounded text-sm">Add Relationship</button>
                </div>
            </div>
        `;
        return map;
    }
    
    showPageEditor() {
        document.getElementById('worldOverview').classList.add('hidden');
        document.getElementById('pageEditor').classList.remove('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        
        if (!this.currentPage) return;
        
        // Update page title
        document.title = `${this.currentWorld.name} — ${this.currentPage.title} | MythIndex`;
        
        // Update page header with flex layout
        const iconClass = this.getPageTypeIcon(this.currentPage.page_type);
        document.getElementById('pageIcon').innerHTML = `<i class="${iconClass} text-white text-2xl"></i>`;
        document.getElementById('pageTitle').textContent = this.currentPage.title;
        
        // Update page type badge
        const pageTypeLabel = this.getPageTypeLabel(this.currentPage.page_type);
        document.getElementById('pageTypeBadge').textContent = pageTypeLabel;
        
        // Update last modified
        const lastModified = new Date(this.currentPage.updated_at).toLocaleString();
        document.getElementById('lastModified').textContent = `Last modified: ${lastModified}`;
        
        // Render properties first (structured-first)
        this.renderProperties();
        
        // Render content blocks as "Notes" section
        this.renderContentBlocks();
    }
    
    renderContentBlocks() {
        const container = document.getElementById('contentBlocks');
        container.innerHTML = '';
        
        const content = this.currentPage.content || [];
        
        content.forEach((block, index) => {
            container.appendChild(this.createBlockElement(block, index));
        });
        
        // Add empty paragraph at the end
        if (content.length === 0 || content[content.length - 1].type !== 'paragraph') {
            const emptyBlock = { id: this.generateId(), type: 'paragraph', content: '', props: {} };
            container.appendChild(this.createBlockElement(emptyBlock, content.length));
        }
        
        // Setup block interactions
        this.setupBlockInteractions();
    }
    
    createBlockElement(block, index) {
        const blockEl = document.createElement('div');
        blockEl.className = 'block-element group relative flex items-start';
        blockEl.dataset.blockId = block.id;
        blockEl.dataset.blockIndex = index;
        blockEl.dataset.blockType = block.type;
        
        // Drag handle
        const dragHandle = document.createElement('div');
        dragHandle.className = 'absolute left-0 top-2 opacity-0 group-hover:opacity-50 cursor-grab text-dark-muted';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.style.left = '-20px';
        dragHandle.style.fontSize = '12px';
        blockEl.appendChild(dragHandle);
        
        // Block content based on type
        let contentEl;
        
        switch (block.type) {
            case 'heading1':
                contentEl = document.createElement('h1');
                contentEl.className = 'text-3xl font-bold mb-2 outline-none flex-1';
                break;
            case 'heading2':
                contentEl = document.createElement('h2');
                contentEl.className = 'text-2xl font-bold mb-2 outline-none flex-1';
                break;
            case 'heading3':
                contentEl = document.createElement('h3');
                contentEl.className = 'text-xl font-bold mb-2 outline-none flex-1';
                break;
            case 'bullet_list':
                contentEl = document.createElement('ul');
                contentEl.className = 'list-disc list-inside mb-2 outline-none flex-1';
                break;
            case 'numbered_list':
                contentEl = document.createElement('ol');
                contentEl.className = 'list-decimal list-inside mb-2 outline-none flex-1';
                break;
            case 'quote':
                contentEl = document.createElement('blockquote');
                contentEl.className = 'border-l-4 border-dark-accent pl-4 italic mb-2 outline-none flex-1';
                break;
            case 'divider':
                contentEl = document.createElement('div');
                contentEl.className = 'border-t border-dark-border my-4 flex-1';
                break;
            case 'callout':
                contentEl = document.createElement('div');
                const calloutType = block.props.type || 'info';
                const calloutIcon = block.props.icon || '💡';
                contentEl.className = `bg-opacity-10 border-l-4 rounded-lg p-4 mb-2 outline-none flex-1 ${this.getCalloutClass(calloutType)}`;
                contentEl.innerHTML = `
                    <div class="flex items-start space-x-3">
                        <span class="text-xl">${calloutIcon}</span>
                        <div class="flex-1" contenteditable="true">${block.content || ''}</div>
                    </div>
                `;
                break;
            case 'two_column':
                contentEl = document.createElement('div');
                contentEl.className = 'grid grid-cols-2 gap-4 mb-2 outline-none flex-1';
                contentEl.innerHTML = `
                    <div class="border border-dark-border rounded p-3 min-h-[100px]" contenteditable="true">${block.content?.left || ''}</div>
                    <div class="border border-dark-border rounded p-3 min-h-[100px]" contenteditable="true">${block.content?.right || ''}</div>
                `;
                break;
            case 'character_card':
            case 'location_pin':
            case 'relationship_map':
                // Remove these block types - use properties panel instead
                return null;
            default:
                contentEl = document.createElement('p');
                contentEl.className = 'mb-2 outline-none flex-1';
        }
        
        if (block.type !== 'divider' && block.type !== 'callout' && block.type !== 'two_column' && 
            block.type !== 'character_card' && block.type !== 'location_pin' && 
            block.type !== 'timeline_entry' && block.type !== 'relationship_map') {
            contentEl.contentEditable = true;
            contentEl.textContent = block.content || '';
            
            contentEl.addEventListener('input', (e) => this.handleBlockContentChange(block.id, e.target.textContent));
            contentEl.addEventListener('keydown', (e) => this.handleBlockKeydown(e, block.id, index));
        }
        
        blockEl.appendChild(contentEl);
        
        // Add block actions
        const blockActions = document.createElement('div');
        blockActions.className = 'absolute right-0 top-2 opacity-0 group-hover:opacity-100 flex items-center space-x-1';
        
        const addBelowBtn = document.createElement('button');
        addBelowBtn.className = 'p-1 hover:bg-dark-bg rounded text-xs';
        addBelowBtn.innerHTML = '<i class="fas fa-plus"></i>';
        addBelowBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.insertNewBlock(index + 1);
        });
        
        const moreBtn = document.createElement('button');
        moreBtn.className = 'p-1 hover:bg-dark-bg rounded text-xs';
        moreBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showBlockMenu(block, e);
        });
        
        blockActions.appendChild(addBelowBtn);
        blockActions.appendChild(moreBtn);
        blockEl.appendChild(blockActions);
        
        return blockEl;
    }
    
    setupBlockInteractions() {
        // Block dragging, focus management, etc.
        document.querySelectorAll('.block-element').forEach(block => {
            block.addEventListener('click', () => {
                this.currentBlock = block.dataset.blockId;
                document.querySelectorAll('.block-element').forEach(b => b.classList.remove('ring-2', 'ring-dark-accent'));
                block.classList.add('ring-2', 'ring-dark-accent');
            });
        });
    }
    
    handleBlockContentChange(blockId, content) {
        if (!this.currentPage) return;
        
        const contentBlocks = [...this.currentPage.content];
        const blockIndex = contentBlocks.findIndex(b => b.id === blockId);
        
        if (blockIndex !== -1) {
            contentBlocks[blockIndex].content = content;
            this.currentPage.content = contentBlocks;
            this.autoSave();
        }
    }
    
    handleBlockKeydown(e, blockId, index) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.insertNewBlock(index + 1);
        } else if (e.key === 'Backspace' && e.target.textContent === '') {
            e.preventDefault();
            if (index > 0) {
                this.deleteBlock(blockId);
                const prevBlock = document.querySelector(`[data-block-index="${index - 1}"]`);
                if (prevBlock) {
                    const contentEl = prevBlock.querySelector('[contenteditable="true"]');
                    if (contentEl) {
                        contentEl.focus();
                        // Move cursor to end
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(contentEl);
                        range.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }
        } else if (e.key === '/') {
            // Show command menu
            setTimeout(() => this.showCommandMenu(e.target), 100);
        } else if (e.target.textContent.startsWith('# ')) {
            this.convertBlockType(blockId, 'heading1');
        } else if (e.target.textContent.startsWith('## ')) {
            this.convertBlockType(blockId, 'heading2');
        } else if (e.target.textContent.startsWith('### ')) {
            this.convertBlockType(blockId, 'heading3');
        } else if (e.target.textContent.startsWith('- ') || e.target.textContent.startsWith('* ')) {
            this.convertBlockType(blockId, 'bullet_list');
        } else if (e.target.textContent.startsWith('> ')) {
            this.convertBlockType(blockId, 'quote');
        }
    }
    
    insertNewBlock(index) {
        if (!this.currentPage) return;
        
        const newBlock = {
            id: this.generateId(),
            type: 'paragraph',
            content: '',
            props: {}
        };
        
        const contentBlocks = [...this.currentPage.content];
        contentBlocks.splice(index, 0, newBlock);
        this.currentPage.content = contentBlocks;
        
        this.renderContentBlocks();
        
        // Focus the new block
        setTimeout(() => {
            const newBlockEl = document.querySelector(`[data-block-index="${index}"]`);
            if (newBlockEl) {
                const contentEl = newBlockEl.querySelector('[contenteditable="true"]');
                if (contentEl) contentEl.focus();
            }
        }, 100);
    }
    
    deleteBlock(blockId) {
        if (!this.currentPage) return;
        
        const contentBlocks = this.currentPage.content.filter(b => b.id !== blockId);
        this.currentPage.content = contentBlocks;
        this.renderContentBlocks();
        this.autoSave();
    }
    
    convertBlockType(blockId, newType) {
        if (!this.currentPage) return;
        
        const contentBlocks = [...this.currentPage.content];
        const blockIndex = contentBlocks.findIndex(b => b.id === blockId);
        
        if (blockIndex !== -1) {
            contentBlocks[blockIndex].type = newType;
            
            // Clean up content based on type
            let content = contentBlocks[blockIndex].content || '';
            if (newType.startsWith('heading')) {
                content = content.replace(/^(#{1,3})\s/, '');
            } else if (newType === 'bullet_list') {
                content = content.replace(/^[-*]\s/, '');
            } else if (newType === 'quote') {
                content = content.replace(/^>\s/, '');
            }
            
            contentBlocks[blockIndex].content = content;
            this.currentPage.content = contentBlocks;
            this.renderContentBlocks();
        }
    }
    
    showCommandMenu(target) {
        const menu = document.getElementById('commandMenu');
        const commandList = document.getElementById('commandList');
        
        const commands = [
            { icon: 'fas fa-paragraph', label: 'Paragraph', type: 'paragraph' },
            { icon: 'fas fa-heading', label: 'Heading 1', type: 'heading1' },
            { icon: 'fas fa-heading', label: 'Heading 2', type: 'heading2' },
            { icon: 'fas fa-heading', label: 'Heading 3', type: 'heading3' },
            { icon: 'fas fa-list', label: 'Bullet List', type: 'bullet_list' },
            { icon: 'fas fa-list-ol', label: 'Numbered List', type: 'numbered_list' },
            { icon: 'fas fa-quote-left', label: 'Quote', type: 'quote' },
            { icon: 'fas fa-comment-dots', label: 'Callout', type: 'callout' },
            { icon: 'fas fa-minus', label: 'Divider', type: 'divider' },
            { icon: 'fas fa-columns', label: 'Two Columns', type: 'two_column' },
            { icon: 'fas fa-clock', label: 'Timeline Entry', type: 'timeline_entry' }
        ];
        
        commandList.innerHTML = commands.map(cmd => `
            <div class="flex items-center space-x-3 p-3 hover:bg-dark-bg cursor-pointer" onclick="app.selectCommand('${cmd.type}')">
                <i class="${cmd.icon} w-5"></i>
                <span>${cmd.label}</span>
            </div>
        `).join('');
        
        // Position menu
        const rect = target.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;
        menu.classList.remove('hidden');
        
        this.commandMenu = { target, blockId: target.closest('.block-element').dataset.blockId };
    }
    
    selectCommand(type) {
        if (this.commandMenu) {
            this.convertBlockType(this.commandMenu.blockId, type);
            this.hideCommandMenu();
        }
    }
    
    hideCommandMenu() {
        document.getElementById('commandMenu').classList.add('hidden');
        this.commandMenu = null;
    }
    
    handleTitleChange(title) {
        if (!this.currentPage) return;
        this.currentPage.title = title;
        this.autoSave();
        
        // Update sidebar
        this.renderSidebar();
    }
    
    renderProperties() {
        const panel = document.getElementById('propertiesContent');
        if (!panel) return;
        
        const pageType = this.currentPage.page_type;
        const properties = this.currentPage.properties || {};
        
        let propertiesHTML = '<div class="space-y-4">';
        
        // Section header
        propertiesHTML += `
            <div class="border-b border-dark-border pb-3 mb-4">
                <h3 class="text-lg font-semibold text-dark-text">${this.getPageTypeLabel(pageType)} Properties</h3>
                <p class="text-sm text-dark-secondary mt-1">Structured information for this ${pageType}</p>
            </div>
        `;
        
        // Render properties based on page type
        switch (pageType) {
            case 'character':
                propertiesHTML += this.renderCharacterProperties(properties);
                break;
            case 'location':
                propertiesHTML += this.renderLocationProperties(properties);
                break;
            case 'faction':
                propertiesHTML += this.renderTimelineProperties(properties);
                this.renderPropertyFields(container, [
                    { key: 'type', label: 'Faction Type', type: 'text' },
                    { key: 'alignment', label: 'Alignment', type: 'text' },
                    { key: 'size', label: 'Size', type: 'text' },
                    { key: 'leader', label: 'Leader', type: 'text' },
                    { key: 'goal', label: 'Goal', type: 'text' }
                ], properties);
                break;
            case 'item':
                this.renderPropertyFields(container, [
                    { key: 'type', label: 'Item Type', type: 'text' },
                    { key: 'rarity', label: 'Rarity', type: 'text' },
                    { key: 'magic', label: 'Magic', type: 'select', options: ['yes', 'no'] },
                    { key: 'owner', label: 'Current Owner', type: 'text' }
                ], properties);
                break;
            case 'lore':
                this.renderPropertyFields(container, [
                    { key: 'category', label: 'Category', type: 'select', options: ['history', 'myth', 'religion', 'magic', 'politics', 'other'] },
                    { key: 'era', label: 'Era', type: 'text' },
                    { key: 'importance', label: 'Importance', type: 'text' }
                ], properties);
                break;
        }
        
        // Add custom properties section
        const customSection = document.createElement('div');
        customSection.className = 'mt-6 pt-4 border-t border-dark-border';
        customSection.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium text-sm">Custom Properties</h4>
                <button onclick="app.addCustomProperty()" class="text-xs text-dark-accent hover:text-dark-accent-hover">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div id="customProperties"></div>
        `;
        container.appendChild(customSection);
        
        this.renderCustomProperties();
    }
    
    renderPropertyFields(container, fields, properties) {
        fields.forEach(field => {
            const fieldEl = document.createElement('div');
            fieldEl.className = 'mb-3';
            
            const label = document.createElement('label');
            label.className = 'block text-xs text-dark-secondary mb-1';
            label.textContent = field.label;
            fieldEl.appendChild(label);
            
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.className = 'w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm outline-none';
                
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select...';
                input.appendChild(defaultOption);
                
                field.options?.forEach(option => {
                    const optionEl = document.createElement('option');
                    optionEl.value = option;
                    optionEl.textContent = option;
                    if (properties[field.key] === option) {
                        optionEl.selected = true;
                    }
                    input.appendChild(optionEl);
                });
            } else {
                input = document.createElement('input');
                input.type = field.type;
                input.className = 'w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm outline-none';
                input.value = properties[field.key] || '';
            }
            
            input.addEventListener('input', () => {
                this.updateProperty(field.key, input.value);
            });
            
            fieldEl.appendChild(input);
            container.appendChild(fieldEl);
        });
    }
    
    renderCustomProperties() {
        const container = document.getElementById('customProperties');
        if (!container) return;
        
        container.innerHTML = '';
        const properties = this.currentPage.properties || {};
        
        Object.entries(properties).forEach(([key, value]) => {
            if (['name', 'age', 'gender', 'race', 'class', 'alignment', 'status', 'type', 'climate', 'population', 'government', 'size', 'leader', 'goal', 'rarity', 'magic', 'owner', 'category', 'era', 'importance'].includes(key)) {
                return; // Skip built-in properties
            }
            
            const propEl = document.createElement('div');
            propEl.className = 'flex items-center space-x-2 mb-2';
            propEl.innerHTML = `
                <input type="text" value="${key}" class="flex-1 px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs outline-none" readonly>
                <input type="text" value="${value}" class="flex-1 px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs outline-none">
                <button onclick="app.removeCustomProperty('${key}')" class="text-dark-secondary hover:text-dark-text">
                    <i class="fas fa-times text-xs"></i>
                </button>
            `;
            
            const valueInput = propEl.querySelector('input[type="text"]:not([readonly])');
            valueInput.addEventListener('input', () => {
                this.updateProperty(key, valueInput.value);
            });
            
            container.appendChild(propEl);
        });
    }
    
    addCustomProperty() {
        const key = prompt('Enter property name:');
        if (!key) return;
        
        const value = prompt('Enter property value:') || '';
        this.updateProperty(key, value);
        this.renderProperties();
    }
    
    removeCustomProperty(key) {
        const properties = { ...this.currentPage.properties };
        delete properties[key];
        this.currentPage.properties = properties;
        this.autoSave();
        this.renderProperties();
    }
    
    updateProperty(key, value) {
        if (!this.currentPage) return;
        
        const properties = { ...this.currentPage.properties };
        if (value) {
            properties[key] = value;
        } else {
            delete properties[key];
        }
        
        this.currentPage.properties = properties;
        this.autoSave();
    }
    
    toggleProperties() {
        const panel = document.getElementById('propertiesPanel');
        panel.classList.toggle('hidden');
    }
    
    hideProperties() {
        document.getElementById('propertiesPanel').classList.add('hidden');
    }
    
    showSearch() {
        document.getElementById('searchModal').classList.remove('hidden');
        document.getElementById('searchInput').focus();
    }
    
    hideSearch() {
        document.getElementById('searchModal').classList.add('hidden');
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }
    
    async handleSearch(query) {
        if (!query) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }
        
        try {
            // Try global search first
            const response = await fetch(`/api/search/global?query=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const results = await response.json();
                this.displayGlobalSearchResults(results);
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
    }
    
    showPageIconPicker() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-dark-card border border-dark-border rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-bold mb-4">Change Page Type</h3>
                <div class="space-y-2">
                    ${[
                        { value: 'document', label: 'Document', icon: 'fas fa-file-alt', color: 'bg-gray-600' },
                        { value: 'character', label: 'Character', icon: 'fas fa-user', color: 'bg-blue-600' },
                        { value: 'location', label: 'Location', icon: 'fas fa-map-marker-alt', color: 'bg-green-600' },
                        { value: 'lore', label: 'Lore', icon: 'fas fa-book', color: 'bg-purple-600' },
                        { value: 'faction', label: 'Faction', icon: 'fas fa-users', color: 'bg-red-600' },
                        { value: 'item', label: 'Item', icon: 'fas fa-gem', color: 'bg-yellow-600' },
                        { value: 'timeline', label: 'Timeline', icon: 'fas fa-clock', color: 'bg-indigo-600' }
                    ].map(type => `
                        <div class="flex items-center space-x-3 p-3 hover:bg-dark-bg rounded cursor-pointer transition" onclick="app.selectPageType('${type.value}')">
                            <div class="w-10 h-10 ${type.color} rounded-lg flex items-center justify-center">
                                <i class="${type.icon} text-white"></i>
                            </div>
                            <div class="flex-1">
                                <div class="font-medium">${type.label}</div>
                                <div class="text-xs text-dark-secondary">${this.getPageTypeDescription(type.value)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="flex justify-end space-x-2 mt-6">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-dark-secondary hover:text-dark-text transition">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    selectPageType(type) {
        this.updatePage(this.currentPage.id, { page_type: type });
        document.querySelector('.fixed.inset-0').remove();
    }
    
    showMoreOptions() {
        const menu = document.createElement('div');
        menu.className = 'fixed bg-dark-card border border-dark-border rounded-lg shadow-lg z-50 py-1';
        menu.style.right = '20px';
        menu.style.top = '80px';
        
        const items = [
            { label: 'Open Relationship Map', action: () => this.showRelationshipMap() },
            { label: 'Duplicate Page', action: () => this.duplicatePage() },
            { label: 'Export Page', action: () => this.exportPage() },
            { label: 'Page Settings', action: () => this.showPageSettings() }
        ];
        
        items.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'px-4 py-2 hover:bg-dark-bg cursor-pointer text-sm';
            menuItem.textContent = item.label;
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }
    
    showRelationshipMap() {
        const modal = document.getElementById('relationshipMapModal');
        modal.classList.remove('hidden');
        
        // Initialize relationship map
        setTimeout(() => this.initializeRelationshipMap(), 100);
    }
    
    hideRelationshipMap() {
        document.getElementById('relationshipMapModal').classList.add('hidden');
        if (this.relationshipNetwork) {
            this.relationshipNetwork.destroy();
            this.relationshipNetwork = null;
        }
    }
    
    initializeRelationshipMap() {
        const container = document.getElementById('relationshipMapContainer');
        
        // Create nodes from pages
        const nodes = this.pages.map(page => ({
            id: page.id,
            label: page.title,
            color: this.getPageTypeColor(page.page_type),
            icon: {
                face: this.getPageTypeIcon(page.page_type).replace('fas fa-', ''),
                color: '#ffffff',
                size: 24
            },
            font: {
                color: '#ffffff',
                size: 14
            },
            borderWidth: 2,
            chosen: true,
            title: `${this.getPageTypeLabel(page.page_type)}: ${page.title}`
        }));
        
        // Create edges from page links (mock data for now)
        const edges = [
            // This will be populated from page_links table later
            { from: 1, to: 2, label: 'parent', color: { color: '#6b7280' } },
            { from: 2, to: 3, label: 'ally', color: { color: '#22c55e' } },
            { from: 1, to: 3, label: 'enemy', color: { color: '#ef4444' } }
        ];
        
        const data = { nodes, edges };
        
        const options = {
            nodes: {
                shape: 'icon',
                icon: {
                    face: 'FontAwesome',
                    size: 40,
                    color: '#ffffff'
                },
                borderWidth: 2,
                shadow: true
            },
            edges: {
                arrows: {
                    to: { enabled: true, scaleFactor: 0.5 }
                },
                smooth: {
                    type: 'cubicBezier',
                    roundness: 0.4
                },
                font: {
                    size: 12,
                    color: '#9ca3af',
                    strokeWidth: 3,
                    strokeColor: '#1f2937'
                }
            },
            physics: {
                enabled: true,
                stabilization: { iterations: 100 }
            },
            interaction: {
                hover: true,
                tooltipDelay: 200,
                zoomView: true,
                dragView: true
            }
        };
        
        this.relationshipNetwork = new vis.Network(container, data, options);
        
        // Handle node clicks
        this.relationshipNetwork.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.hideRelationshipMap();
                this.openPage(nodeId);
            }
        });
    }
    
    zoomInMap() {
        if (this.relationshipNetwork) {
            const scale = this.relationshipNetwork.getScale();
            this.relationshipNetwork.moveTo({ scale: scale * 1.2 });
        }
    }
    
    zoomOutMap() {
        if (this.relationshipNetwork) {
            const scale = this.relationshipNetwork.getScale();
            this.relationshipNetwork.moveTo({ scale: scale * 0.8 });
        }
    }
    
    addTimelineEvent() {
        if (!this.currentPage.properties.events) {
            this.currentPage.properties.events = [];
        }
        
        const newEvent = {
            date: new Date().toISOString().split('T')[0],
            title: 'New Event',
            description: '',
            related_pages: []
        };
        
        this.currentPage.properties.events.push(newEvent);
        this.renderProperties();
        this.autoSave();
    }
    
    removeTimelineEvent(index) {
        this.currentPage.properties.events.splice(index, 1);
        this.renderProperties();
        this.autoSave();
    }
    
    updateTimelineEvent(index, field, value) {
        if (!this.currentPage.properties.events[index]) {
            this.currentPage.properties.events[index] = {};
        }
        this.currentPage.properties.events[index][field] = value;
        this.autoSave();
    }
    
    showPageLinker(eventIndex) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-dark-card border border-dark-border rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-bold mb-4">Link to Page</h3>
                <div class="space-y-3">
                    <input type="text" id="pageSearchInput" placeholder="Search pages..." 
                           class="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg outline-none focus:border-dark-accent">
                    <div id="pageSearchResults" class="max-h-48 overflow-y-auto space-y-2">
                        <!-- Search results will be rendered here -->
                    </div>
                </div>
                <div class="flex justify-end space-x-2 mt-4">
                    <button onclick="this.closest('.fixed').remove()" class="px-4 py-2 text-dark-secondary hover:text-dark-text transition">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const searchInput = modal.querySelector('#pageSearchInput');
        const searchResults = modal.querySelector('#pageSearchResults');
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filteredPages = this.pages.filter(page => 
                page.id !== this.currentPage.id && 
                page.title.toLowerCase().includes(query)
            );
            
            searchResults.innerHTML = filteredPages.map(page => `
                <div class="flex items-center space-x-2 p-2 hover:bg-dark-bg rounded cursor-pointer" 
                     onclick="app.linkPageToEvent(${eventIndex}, ${page.id}); this.closest('.fixed').remove();">
                    <div class="w-6 h-6 bg-${this.getPageTypeColor(page.page_type)} rounded flex items-center justify-center">
                        <i class="${this.getPageTypeIcon(page.page_type)} text-white text-xs"></i>
                    </div>
                    <div class="flex-1">
                        <div class="text-sm font-medium">${page.title}</div>
                        <div class="text-xs text-dark-secondary">${this.getPageTypeLabel(page.page_type)}</div>
                    </div>
                </div>
            `).join('');
        });
        
        // Initial search
        searchInput.dispatchEvent(new Event('input'));
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    linkPageToEvent(eventIndex, pageId) {
        if (!this.currentPage.properties.events[eventIndex].related_pages) {
            this.currentPage.properties.events[eventIndex].related_pages = [];
        }
        
        if (!this.currentPage.properties.events[eventIndex].related_pages.includes(pageId)) {
            this.currentPage.properties.events[eventIndex].related_pages.push(pageId);
            this.renderProperties();
            this.autoSave();
        }
    }
    
    async performGlobalSearch(query) {
        try {
            const response = await fetch(`/api/search/global?query=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (response.ok) {
                const results = await response.json();
                this.displayGlobalSearchResults(results);
            }
        } catch (error) {
            console.error('Global search failed:', error);
        }
    }
    
    displayGlobalSearchResults(results) {
        const resultsEl = document.getElementById('searchResults');
        
        let resultsHTML = '';
        
        // Display worlds
        if (results.worlds && results.worlds.length > 0) {
            resultsHTML += `
                <div class="mb-4">
                    <h4 class="text-sm font-semibold text-dark-secondary mb-2">Worlds</h4>
                    ${results.worlds.map(world => `
                        <div onclick="app.switchToWorld(${world.id})" class="flex items-center space-x-3 p-3 hover:bg-dark-bg cursor-pointer rounded">
                            <div class="w-8 h-8 rounded flex items-center justify-center" style="background-color: ${world.cover_color || '#7c6fea'}">
                                <span class="text-white text-xs font-bold">${world.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <div class="flex-1">
                                <div class="font-medium">${world.name}</div>
                                <div class="text-xs text-dark-secondary">${world.description || 'No description'}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Display pages
        if (results.pages && results.pages.length > 0) {
            resultsHTML += `
                <div>
                    <h4 class="text-sm font-semibold text-dark-secondary mb-2">Pages</h4>
                    ${results.pages.map(page => `
                        <div onclick="app.switchToWorldAndOpenPage(${page.world_id}, ${page.id})" class="flex items-center space-x-3 p-3 hover:bg-dark-bg cursor-pointer rounded">
                            <div class="w-8 h-8 bg-${this.getPageTypeColor(page.page_type)} rounded flex items-center justify-center">
                                <i class="${this.getPageTypeIcon(page.page_type)} text-white text-sm"></i>
                            </div>
                            <div class="flex-1">
                                <div class="font-medium">${page.title}</div>
                                <div class="text-xs text-dark-secondary">${this.getPageTypeLabel(page.page_type)} • ${page.world_name}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (!resultsHTML) {
            resultsHTML = '<div class="text-center text-dark-secondary py-4">No results found</div>';
        }
        
        resultsEl.innerHTML = resultsHTML;
    }
    
    switchToWorld(worldId) {
        this.loadWorld(worldId);
        this.hideSearch();
    }
    
    switchToWorldAndOpenPage(worldId, pageId) {
        this.loadWorld(worldId).then(() => {
            this.openPage(pageId);
            this.hideSearch();
        });
    }
    
    showCreateWorld() {
        document.getElementById('worldPickerModal').classList.add('hidden');
        document.getElementById('createWorldModal').classList.remove('hidden');
    }
    
    hideCreateWorld() {
        document.getElementById('createWorldModal').classList.add('hidden');
        document.getElementById('createWorldForm').reset();
    }
    
    async handleCreateWorld(e) {
        e.preventDefault();
        
        const worldData = {
            name: document.getElementById('worldName').value,
            description: document.getElementById('worldDescription').value,
            genre: document.getElementById('worldGenre').value,
            tone: document.getElementById('worldTone').value,
            cover_color: document.getElementById('worldColor').value
        };
        
        try {
            const response = await fetch('/worlds', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(worldData)
            });
            
            if (response.ok) {
                const newWorld = await response.json();
                this.worlds.push(newWorld);
                this.openWorld(newWorld.id);
                this.hideCreateWorld();
                this.showToast('World created successfully', 'success');
            } else {
                const error = await response.json();
                this.showToast(error.error, 'error');
            }
        } catch (error) {
            this.showToast('Failed to create world', 'error');
        }
    }
    
    async updatePage(pageId, updates) {
        try {
            const response = await fetch(`/pages/${pageId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updates)
            });
            
            if (response.ok) {
                const updatedPage = await response.json();
                
                if (this.currentPage?.id === pageId) {
                    this.currentPage = updatedPage;
                }
                
                // Update pages list
                const index = this.pages.findIndex(p => p.id === pageId);
                if (index !== -1) {
                    this.pages[index] = updatedPage;
                }
                
                return updatedPage;
            }
        } catch (error) {
            console.error('Failed to update page:', error);
        }
    }
    
    autoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.showToast('Saving...', 'info');
        
        this.autoSaveTimeout = setTimeout(async () => {
            if (!this.currentPage) return;
            
            try {
                await this.updatePage(this.currentPage.id, {
                    title: this.currentPage.title,
                    content: this.currentPage.content,
                    properties: this.currentPage.properties
                });
                this.showToast('Saved', 'success');
            } catch (error) {
                this.showToast('Failed to save', 'error');
            }
        }, 800);
    }
    
    showEmptyState() {
        document.getElementById('worldOverview').classList.add('hidden');
        document.getElementById('pageEditor').classList.add('hidden');
        document.getElementById('emptyState').classList.remove('hidden');
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };
        
        toast.className = `${colors[type]} text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    handleKeyboard(e) {
        // Ctrl+K for search
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            this.showSearch();
        }
        
        // Ctrl+N for new page
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            this.addPage();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            this.hideSearch();
            this.hideCommandMenu();
            this.hideIconPicker();
            this.hideProperties();
        }
    }
    
    generateId() {
        return 'block_' + Math.random().toString(36).substr(2, 9);
    }
}

// Initialize app
const app = new MythIndexApp();
