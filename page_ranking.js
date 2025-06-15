const { MongoClient } = require('mongodb');

class PageRankCalculator {
    constructor(mongoUrl, dbName, collectionName) {
        this.mongoUrl = mongoUrl;
        this.dbName = dbName;
        this.collectionName = collectionName;
        this.client = null;
        this.db = null;
        this.collection = null;
        
        // PageRank algorithm parameters
        this.dampingFactor = 0.85;
        this.maxIterations = 100;
        this.tolerance = 0.0001;
    }

    async connect() {
        this.client = new MongoClient(this.mongoUrl);
        await this.client.connect();
        this.db = this.client.db(this.dbName);
        this.collection = this.db.collection(this.collectionName);
        console.log('Connected to MongoDB');
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            console.log('Disconnected from MongoDB');
        }
    }

    // Main function following the flowchart logic
    async getPageRank(pageUrl) {
        try {
            console.log(\n=== Getting PageRank for: ${pageUrl} ===);
            
            // Step 1: Check if webpage has computed pagerank in PageInformationCollection
            const pageDoc = await this.collection.findOne({ pageURL: pageUrl });
            
            if (!pageDoc) {
                console.log(Page ${pageUrl} not found in database);
                return null;
            }

            // Check if CurrentPageRank exists and is not 0 (computed)
            if (pageDoc.CurrentPageRank && pageDoc.CurrentPageRank > 0) {
                console.log(Found pre-computed PageRank: ${pageDoc.CurrentPageRank});
                return pageDoc.CurrentPageRank;
            }

            console.log('PageRank not computed yet, calculating...');
            
            // Step 2: Send null as response (in practice, we'll calculate and return)
            // Step 3: Send subsequent request to getpagerandata route
            // Step 4-6: Calculate PageRank using the adjacency matrix approach
            
            const calculatedRank = await this.calculatePageRank(pageUrl);
            
            // Step 7: Update document entry in PageInformationCollection
            await this.collection.updateOne(
                { pageURL: pageUrl },
                { $set: { CurrentPageRank: calculatedRank } }
            );
            
            console.log(Calculated and stored PageRank: ${calculatedRank});
            return calculatedRank;
            
        } catch (error) {
            console.error('Error getting PageRank:', error);
            throw error;
        }
    }

    // Calculate PageRank using the iterative algorithm
    async calculatePageRank(targetUrl) {
        try {
            // Get all pages that reference the target page
            const referencingPages = await this.getReferencingPages(targetUrl);
            console.log(Found ${referencingPages.length} pages referencing ${targetUrl});
            
            if (referencingPages.length === 0) {
                return 0.15; // Base PageRank for pages with no incoming links
            }

            // Build adjacency information for PageRank calculation
            const adjacencyData = await this.buildAdjacencyMatrix(targetUrl, referencingPages);
            
            // Calculate PageRank using power iteration method
            const pageRank = this.computePageRankValue(adjacencyData, targetUrl);
            
            return pageRank;
            
        } catch (error) {
            console.error('Error calculating PageRank:', error);
            throw error;
        }
    }

    // Get pages that reference the target page (from WebsitesReferencingThisPage)
    async getReferencingPages(targetUrl) {
        const targetDoc = await this.collection.findOne({ pageURL: targetUrl });
        
        if (!targetDoc || !targetDoc.WebsitesReferencingThisPage) {
            return [];
        }
        
        return targetDoc.WebsitesReferencingThisPage;
    }

    // Build adjacency matrix data for PageRank calculation
    async buildAdjacencyMatrix(targetUrl, referencingPages) {
        const adjacencyData = {
            pages: [targetUrl, ...referencingPages],
            outLinks: new Map(),
            inLinks: new Map()
        };

        // Initialize maps
        adjacencyData.pages.forEach(page => {
            adjacencyData.outLinks.set(page, []);
            adjacencyData.inLinks.set(page, []);
        });

        // For each referencing page, get its embedded URLs (outgoing links)
        for (const referencingPage of referencingPages) {
            const pageDoc = await this.collection.findOne({ pageURL: referencingPage });
            
            if (pageDoc && pageDoc.EmbeddedURLs) {
                // Store outgoing links
                adjacencyData.outLinks.set(referencingPage, pageDoc.EmbeddedURLs);
                
                // Update incoming links for referenced pages
                pageDoc.EmbeddedURLs.forEach(linkedUrl => {
                    if (adjacencyData.inLinks.has(linkedUrl)) {
                        adjacencyData.inLinks.get(linkedUrl).push(referencingPage);
                    }
                });
            }
        }

        // Ensure target page has its incoming links set
        adjacencyData.inLinks.set(targetUrl, referencingPages);
        
        return adjacencyData;
    }

    // Compute PageRank value using simplified algorithm
    computePageRankValue(adjacencyData, targetUrl) {
        const pages = adjacencyData.pages;
        const n = pages.length;
        
        if (n <= 1) {
            return 0.15;
        }

        // Initialize PageRank values
        let pageRanks = new Map();
        pages.forEach(page => {
            pageRanks.set(page, 1.0 / n);
        });

        // Iterative calculation
        for (let iteration = 0; iteration < this.maxIterations; iteration++) {
            const newPageRanks = new Map();
            let hasConverged = true;

            pages.forEach(page => {
                let rank = (1 - this.dampingFactor) / n;
                
                // Add contributions from pages that link to this page
                const incomingLinks = adjacencyData.inLinks.get(page) || [];
                
                incomingLinks.forEach(linkingPage => {
                    const linkingPageRank = pageRanks.get(linkingPage) || 0;
                    const outgoingLinksCount = (adjacencyData.outLinks.get(linkingPage) || []).length;
                    
                    if (outgoingLinksCount > 0) {
                        rank += this.dampingFactor * (linkingPageRank / outgoingLinksCount);
                    }
                });

                newPageRanks.set(page, rank);
                
                // Check convergence
                const oldRank = pageRanks.get(page) || 0;
                if (Math.abs(rank - oldRank) > this.tolerance) {
                    hasConverged = false;
                }
            });

            pageRanks = newPageRanks;
            
            if (hasConverged) {
                console.log(PageRank converged after ${iteration + 1} iterations);
                break;
            }
        }

        return pageRanks.get(targetUrl) || 0.15;
    }

    // API endpoint simulation following the flowchart
    async handleGetPageRankRequest(req, res) {
        try {
            const { pageUrl } = req.body; // Assuming pageUrl is passed in request body
            
            if (!pageUrl) {
                return res.status(400).json({ error: 'pageUrl is required' });
            }

            const pageRank = await this.getPageRank(pageUrl);
            
            if (pageRank === null) {
                return res.status(404).json({ error: 'Page not found' });
            }

            res.json({ 
                pageUrl: pageUrl,
                pageRank: pageRank,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('API Error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Utility method to update referencing relationships
    async updatePageReferences(pageUrl, embeddedUrls) {
        try {
            // Update the current page's embedded URLs
            await this.collection.updateOne(
                { pageURL: pageUrl },
                { 
                    $set: { EmbeddedURLs: embeddedUrls },
                    $setOnInsert: { CurrentPageRank: 0 }
                },
                { upsert: true }
            );

            // Update WebsitesReferencingThisPage for each embedded URL
            for (const embeddedUrl of embeddedUrls) {
                await this.collection.updateOne(
                    { pageURL: embeddedUrl },
                    { 
                        $addToSet: { WebsitesReferencingThisPage: pageUrl },
                        $setOnInsert: { CurrentPageRank: 0, EmbeddedURLs: [] }
                    },
                    { upsert: true }
                );
            }

            console.log(Updated references for ${pageUrl});
            
        } catch (error) {
            console.error('Error updating page references:', error);
            throw error;
        }
    }
}

// Usage Example
async function example() {
    const calculator = new PageRankCalculator(
        'mongodb://localhost:27017',
        'search_engine',
        'pagedatas'
    );

    try {
        await calculator.connect();
        
        // Example: Get PageRank for a specific URL
        const pageRank = await calculator.getPageRank('medium.com');
        console.log(Final PageRank for medium.com: ${pageRank});
        
        // Example: Update page references (when crawling new data)
        await calculator.updatePageReferences('example.com', ['medium.com', 'google.com']);
        
    } catch (error) {
        console.error('Example error:', error);
    } finally {
        await calculator.disconnect();
    }
}

// Express.js integration example
const express = require('express');
const app = express();
app.use(express.json());

const calculator = new PageRankCalculator(
    'mongodb://localhost:27017',
    'search_engine', 
    'pagedatas'
);

// Initialize connection
calculator.connect().catch(console.error);

// API endpoint following the flowchart
app.post('/getPageRank', (req, res) => {
    calculator.handleGetPageRankRequest(req, res);
});

// Additional endpoint for updating page data
app.post('/updatePageData', async (req, res) => {
    try {
        const { pageUrl, embeddedUrls } = req.body;
        await calculator.updatePageReferences(pageUrl, embeddedUrls);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(PageRank API server running on port ${PORT});
});

module.exports = PageRankCalculator;
