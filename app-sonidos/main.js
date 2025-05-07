document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos DOM
    const searchBox = document.getElementById('searchBox');
    const searchResults = document.getElementById('searchResults');
    const interactionsList = document.getElementById('interactionsList');
    const emptyState = document.getElementById('emptyState');
    const profileIcon = document.getElementById('profileIcon');
    const profileMenu = document.getElementById('profileMenu');
    const profileMenuItem = document.getElementById('profileMenuItem');
    const settingsMenuItem = document.getElementById('settingsMenuItem');
    const logoutMenuItem = document.getElementById('logoutMenuItem');
    
    // Al iniciar, verificar el usuario actualmente logueado
    const currentUser = checkLoggedInUser();
    
    // Configurar la inicial del usuario en el icono de perfil
    if (currentUser && currentUser.username) {
        profileIcon.querySelector('span').textContent = currentUser.username.charAt(0).toUpperCase();
    }
    
    // Abrir/cerrar menú de perfil
    profileIcon.addEventListener('click', function() {
        profileMenu.classList.toggle('active');
    });
    
    // Cerrar menú de perfil si se hace clic en cualquier otro lugar
    document.addEventListener('click', function(event) {
        if (!profileIcon.contains(event.target) && !profileMenu.contains(event.target)) {
            profileMenu.classList.remove('active');
        }
    });
    
    // Manejadores para las opciones del menú de perfil
    profileMenuItem.addEventListener('click', function() {
        // Navegar a la página de perfil
        window.location.href = 'profile.html';
    });
    
    settingsMenuItem.addEventListener('click', function() {
        // Navegar a la página de ajustes
        window.location.href = 'settings.html';
    });
    
    logoutMenuItem.addEventListener('click', function() {
        // Cerrar sesión
        logout();
    });
    
    // Manejar la búsqueda de usuarios
    searchBox.addEventListener('input', function() {
        const searchTerm = this.value.trim();
        
        if (searchTerm.length > 0) {
            // Realizar búsqueda de usuarios
            searchUsers(searchTerm);
        } else {
            // Ocultar resultados si el campo está vacío
            searchResults.style.display = 'none';
        }
    });
    
    // Cargar interacciones existentes
    loadInteractions();
    
    // Función para verificar el usuario logueado (simulada)
    function checkLoggedInUser() {
        // Esto normalmente vendría de una sesión o token almacenado
        // Por ahora, retornamos un usuario de ejemplo
        return {
            id: 1,
            username: 'usuario',
            email: 'usuario@ejemplo.com'
        };
    }
    
    // Función para cerrar sesión
    function logout() {
        // Eliminar tokens de sesión, etc.
        localStorage.removeItem('authToken');
        // Redirigir a la página de login
        window.location.href = 'login.html';
    }
    
    // Función para buscar usuarios
    function searchUsers(searchTerm) {
        // En una implementación real, esto sería una petición a la API
        fetch(`http://localhost:3000/api/users/search?term=${searchTerm}`)
            .then(response => response.json())
            .then(data => {
                displaySearchResults(data);
            })
            .catch(error => {
                console.error('Error en la búsqueda:', error);
                // Para demostración, mostrar resultados de ejemplo
                displayMockSearchResults(searchTerm);
            });
    }
    
    // Función para mostrar resultados de búsqueda simulados (para demostración)
    function displayMockSearchResults(searchTerm) {
        // Crear algunos usuarios de ejemplo que coincidan con el término de búsqueda
        const mockUsers = [
            { id: 2, username: 'ana' + searchTerm, status: 'none' },
            { id: 3, username: searchTerm + 'miguel', status: 'friend' },
            { id: 4, username: 'carlos_' + searchTerm, status: 'pending' }
        ];
        
        displaySearchResults(mockUsers);
    }
    
    // Función para mostrar resultados de búsqueda
    function displaySearchResults(users) {
        // Limpiar resultados anteriores
        searchResults.innerHTML = '';
        
        if (users.length === 0) {
            searchResults.innerHTML = '<div class="empty-state" style="padding: 1rem;">No se encontraron usuarios</div>';
            searchResults.style.display = 'block';
            return;
        }
        
        // Mostrar cada usuario encontrado
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'user-result';
            
            // Determinar el texto del estado de amistad
            let statusText = '';
            let buttonHtml = '';
            
            switch(user.status) {
                case 'friend':
                    statusText = 'Ya son amigos';
                    break;
                case 'pending':
                    statusText = 'Solicitud pendiente';
                    break;
                case 'none':
                default:
                    statusText = '';
                    buttonHtml = '<button class="add-friend-btn">Añadir</button>';
                    break;
            }
            
            userElement.innerHTML = `
                <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="friend-status">${statusText}</div>
                </div>
                ${buttonHtml}
            `;
            
            // Agregar evento para añadir amigo
            const addButton = userElement.querySelector('.add-friend-btn');
            if (addButton) {
                addButton.addEventListener('click', function(e) {
                    e.stopPropagation();
                    sendFriendRequest(user.id);
                    this.disabled = true;
                    this.textContent = 'Enviado';
                    userElement.querySelector('.friend-status').textContent = 'Solicitud enviada';
                });
            }
            
            // Clic en el usuario para ver su perfil
            userElement.addEventListener('click', function() {
                window.location.href = `user.html?id=${user.id}`;
            });
            
            searchResults.appendChild(userElement);
        });
        
        searchResults.style.display = 'block';
    }
    
    // Función para enviar solicitud de amistad
    function sendFriendRequest(userId) {
        // En implementación real, esto sería una petición POST a la API
        console.log(`Enviando solicitud de amistad al usuario ${userId}`);
        
        fetch('http://localhost:3000/api/friends/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: userId })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Solicitud enviada:', data);
        })
        .catch(error => {
            console.error('Error al enviar solicitud:', error);
        });
    }
    
    // Función para cargar interacciones existentes
    function loadInteractions() {
        // En implementación real, esto sería una petición GET a la API
        fetch('http://localhost:3000/api/interactions')
            .then(response => response.json())
            .then(data => {
                displayInteractions(data);
            })
            .catch(error => {
                console.error('Error al cargar interacciones:', error);
                // Para demostración, mostrar interacciones de ejemplo
                displayMockInteractions();
            });
    }
    
    // Función para mostrar interacciones simuladas (para demostración)
    function displayMockInteractions() {
        // Crear algunas interacciones de ejemplo
        const mockInteractions = [
            { 
                id: 1, 
                user: { id: 2, username: 'Ana' },
                lastMessage: 'Te acabo de enviar un audio nuevo!',
                hasAudio: true,
                timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            { 
                id: 2, 
                user: { id: 3, username: 'Miguel' },
                lastMessage: 'Escucha esto!',
                hasAudio: true,
                timestamp: new Date(Date.now() - 86400000).toISOString()
            }
        ];
        
        displayInteractions(mockInteractions);
    }
    
    // Función para mostrar interacciones
    function displayInteractions(interactions) {
        // Ocultar el estado vacío si hay interacciones
        if (interactions.length > 0) {
            emptyState.style.display = 'none';
        } else {
            emptyState.style.display = 'block';
            return;
        }
        
        // Mostrar cada interacción
        interactions.forEach(interaction => {
            const interactionElement = document.createElement('div');
            interactionElement.className = 'interaction-card';
            
            // Formatear tiempo relativo
            const timestamp = new Date(interaction.timestamp);
            const timeAgo = getTimeAgo(timestamp);
            
            interactionElement.innerHTML = `
                <div class="interaction-header">
                    <div class="interaction-avatar">${interaction.user.username.charAt(0).toUpperCase()}</div>
                    <div class="interaction-info">
                        <div class="interaction-name">${interaction.user.username}</div>
                        <div class="interaction-time">${timeAgo}</div>
                    </div>
                </div>
                <div class="interaction-preview">${interaction.lastMessage}</div>
                ${interaction.hasAudio ? `
                <div class="audio-indicator">
                    <i class="fas fa-volume-up"></i>
                    <div class="audio-wave">
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                        <div class="wave-bar"></div>
                    </div>
                </div>
                ` : ''}
            `;
            
            // Abrir la interacción al hacer clic
            interactionElement.addEventListener('click', function() {
                window.location.href = `interaction.html?id=${interaction.id}`;
            });
            
            interactionsList.appendChild(interactionElement);
        });
    }
    
    // Función para formatear tiempo relativo
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval > 1) return interval + " años atrás";
        if (interval === 1) return "hace 1 año";
        
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) return interval + " meses atrás";
        if (interval === 1) return "hace 1 mes";
        
        interval = Math.floor(seconds / 86400);
        if (interval > 1) return interval + " días atrás";
        if (interval === 1) return "ayer";
        
        interval = Math.floor(seconds / 3600);
        if (interval > 1) return interval + " horas atrás";
        if (interval === 1) return "hace 1 hora";
        
        interval = Math.floor(seconds / 60);
        if (interval > 1) return interval + " minutos atrás";
        if (interval === 1) return "hace 1 minuto";
        
        if (seconds < 10) return "ahora mismo";
        
        return "hace " + Math.floor(seconds) + " segundos";
    }
});