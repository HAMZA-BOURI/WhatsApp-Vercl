// public/js/clients-dashboard.js

/**
 * Client Information Dashboard
 * This script manages the clients dashboard view that displays data from Google Sheets
 */
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const clientsTable = document.getElementById('clients-table');
    const clientsTableBody = document.getElementById('clients-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const refreshButton = document.getElementById('refresh-button');
    const searchInput = document.getElementById('search-input');
    const totalClientsCount = document.getElementById('total-clients-count');
    
    // Load clients data when page loads
    loadClientsData();
    
    // Refresh button event listener
    if (refreshButton) {
      refreshButton.addEventListener('click', function() {
        loadClientsData();
      });
    }
    
    // Search input event listener
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        filterClientsTable(this.value);
      });
    }
    
    /**
     * Load clients data from the API
     */
    function loadClientsData() {
      // Show loading indicator
      if (loadingIndicator) loadingIndicator.style.display = 'block';
      if (errorMessage) errorMessage.style.display = 'none';
      
      // Fetch clients data from API
      fetch('/api/clients')
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch clients data');
          }
          return response.json();
        })
        .then(data => {
          if (data.success && data.clients) {
            renderClientsTable(data.clients);
            if (totalClientsCount) totalClientsCount.textContent = data.clients.length;
          } else {
            showError('No clients data found');
          }
        })
        .catch(error => {
          console.error('Error fetching clients data:', error);
          showError('Error fetching clients data: ' + error.message);
        })
        .finally(() => {
          // Hide loading indicator
          if (loadingIndicator) loadingIndicator.style.display = 'none';
        });
    }
    
    /**
     * Render clients table with data
     * @param {Array} clients Array of client objects
     */
    function renderClientsTable(clients) {
      if (!clientsTableBody) return;
      
      // Clear existing rows
      clientsTableBody.innerHTML = '';
      
      if (clients.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
          <td colspan="6" class="text-center p-3">No clients found</td>
        `;
        clientsTableBody.appendChild(emptyRow);
        return;
      }
      
      // Add clients to table
      clients.forEach((client, index) => {
        const row = document.createElement('tr');
        
        // Format timestamp
        let formattedTimestamp = 'N/A';
        if (client.timestamp) {
          try {
            const date = new Date(client.timestamp);
            formattedTimestamp = date.toLocaleString();
          } catch (e) {
            formattedTimestamp = client.timestamp;
          }
        }
        
        // Create table row
        row.innerHTML = `
          <td class="p-2">${index + 1}</td>
          <td class="p-2">${client.name || 'N/A'}</td>
          <td class="p-2">${client.city || 'N/A'}</td>
          <td class="p-2">${client.phoneNumber || 'N/A'}</td>
          <td class="p-2">${client.notes || ''}</td>
          <td class="p-2">${formattedTimestamp}</td>
        `;
        
        clientsTableBody.appendChild(row);
      });
    }
    
    /**
     * Filter clients table by search term
     * @param {string} searchTerm Search term to filter by
     */
    function filterClientsTable(searchTerm) {
      if (!clientsTableBody) return;
      
      searchTerm = searchTerm.toLowerCase();
      
      // Get all rows in the table body
      const rows = clientsTableBody.querySelectorAll('tr');
      
      // Loop through rows and hide/show based on search term
      rows.forEach(row => {
        const rowText = row.textContent.toLowerCase();
        
        if (rowText.includes(searchTerm)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }
    
    /**
     * Show error message
     * @param {string} message Error message to display
     */
    function showError(message) {
      if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
      }
    }
  });