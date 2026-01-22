import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Layers, 
  FileBox, 
  LogOut, 
  Search, 
  ChevronRight, 
  Loader2, 
  Eye, 
  FolderOpen,
  LayoutGrid,
  List
} from 'lucide-react';

/**
 * CONFIGURATION & CONSTANTS
 * ------------------------------------------------------------------
 * Setup based on the "Trimble Connect Extension Development Guide".
 */

// Set to FALSE to attempt real API calls (requires hosting in TC environment)
// Set to TRUE to simulate data for development/demo purposes
const DEMO_MODE = true; 

const SUPPORTED_EXTENSIONS = ['trb', 'ifc', 'rvt', 'skp', 'dwg'];

// Simulated Data for Demo Mode
const MOCK_DATA = {
  projects: [
    { id: 'proj-1', name: 'Westside Hospital Complex', rootFolderId: 'folder-1', region: 'us-east' },
    { id: 'proj-2', name: 'Downtown Office Tower', rootFolderId: 'folder-2', region: 'eu-central' },
    { id: 'proj-3', name: 'City Bridge Renovation', rootFolderId: 'folder-3', region: 'asia-pacific' },
  ],
  files: {
    'folder-1': [
      { id: 'file-101', name: 'Architecture_Main.ifc', type: 'IFC', size: '45 MB', parentId: 'folder-1' },
      { id: 'file-102', name: 'Structure_Steel.trb', type: 'TRB', size: '12 MB', parentId: 'folder-1' },
      { id: 'file-103', name: 'HVAC_Level1.rvt', type: 'RVT', size: '120 MB', parentId: 'folder-1' },
    ],
    'folder-2': [
      { id: 'file-201', name: 'Site_Plan.dwg', type: 'DWG', size: '5 MB', parentId: 'folder-2' },
      { id: 'file-202', name: 'Facade.skp', type: 'SKP', size: '15 MB', parentId: 'folder-2' },
    ]
  }
};

/**
 * ------------------------------------------------------------------
 * SERVICE LAYER (The "Expandable" Architecture)
 * ------------------------------------------------------------------
 * These services encapsulate logic. To add "Clash Detection" later,
 * you would simply add a `ClashService` object here.
 */

const AuthService = {
  accessToken: null,

  async login() {
    if (DEMO_MODE) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));
      this.accessToken = "mock-token-12345";
      return this.accessToken;
    }

    // REAL IMPLEMENTATION (Requires trimble-connect-workspace-api)
    // const api = await getWorkspaceAPI();
    // this.accessToken = await api.extension.requestPermission("accesstoken");
    // return this.accessToken;
    console.warn("Real Auth implementation required");
    return null;
  },

  getToken() {
    return this.accessToken;
  }
};

const DiscoveryService = {
  // Queries the global master region to find where user data lives
  async getRegionEndpoint(regionCode) {
    if (DEMO_MODE) return "https://app.connect.trimble.com";
    // Real impl would call GET /regions and map the code
    return "https://app.connect.trimble.com";
  }
};

const ProjectService = {
  async getProjects() {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return MOCK_DATA.projects;
    }
    
    // Real implementation: GET /projects
    // Headers: Authorization: Bearer {token}
    const token = AuthService.getToken();
    if (!token) throw new Error("Not authenticated");
    
    // Example Fetch (Commented out):
    // const response = await fetch('https://app.connect.trimble.com/tc/api/2.0/projects', {
    //   headers: { Authorization: `Bearer ${token}` }
    // });
    // return response.json();
    return [];
  }
};

const FileService = {
  // Implements the "Recursive Traversal" or "Search" strategy from the guide
  async getModels(projectId, rootFolderId) {
    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Return mock files if they exist, or empty array
      return MOCK_DATA.files[rootFolderId] || [];
    }

    // Real implementation: Prefer Search API for scalability
    // POST /search
    // Query: extension:ifc OR extension:trb ...
    return [];
  }
};

const ViewerService = {
  // Wrapper for the Viewer API
  async loadModels(project, models) {
    console.log(`Initializing Viewer for Project ${project.id} with models:`, models.map(m => m.name));
    
    if (DEMO_MODE) {
      return "Viewer Initialized (Mock)";
    }

    // Real Implementation:
    // const api = await getWorkspaceAPI();
    // await api.embed.init3DViewer({
    //    projectId: project.id,
    //    modelId: models[0].id,
    //    additionalModelIds: models.slice(1).map(m => m.id)
    // });
  }
};


/**
 * ------------------------------------------------------------------
 * UI COMPONENTS
 * ------------------------------------------------------------------
 */

const Button = ({ children, onClick, variant = 'primary', disabled = false, icon: Icon, className = '' }) => {
  const baseStyle = "flex items-center justify-center px-4 py-2 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary: "bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-gray-400",
    outline: "border border-gray-300 hover:bg-gray-50 text-gray-700",
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      className={`${baseStyle} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
};

const Card = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 ${onClick ? 'cursor-pointer hover:border-blue-300' : ''} ${className}`}
  >
    {children}
  </div>
);

/**
 * ------------------------------------------------------------------
 * MAIN APPLICATION COMPONENT
 * ------------------------------------------------------------------
 */

export default function App() {
  // State Machine: 'auth' -> 'projects' -> 'models' -> 'viewer'
  const [view, setView] = useState('auth'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [models, setModels] = useState([]);
  const [selectedModelIds, setSelectedModelIds] = useState(new Set());

  // 1. Authentication Flow
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await AuthService.login();
      if (token) {
        await fetchProjects();
      } else {
        setError("Failed to retrieve access token.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Projects
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await ProjectService.getProjects();
      setProjects(data);
      setView('projects');
    } catch (err) {
      setError("Failed to load projects: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Select Project & Fetch Models
  const handleProjectSelect = async (project) => {
    setSelectedProject(project);
    setLoading(true);
    try {
      const files = await FileService.getModels(project.id, project.rootFolderId);
      setModels(files);
      setSelectedModelIds(new Set()); // Reset selection
      setView('models');
    } catch (err) {
      setError("Failed to load models: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Toggle Model Selection
  const toggleModelSelection = (modelId) => {
    const newSelection = new Set(selectedModelIds);
    if (newSelection.has(modelId)) {
      newSelection.delete(modelId);
    } else {
      newSelection.add(modelId);
    }
    setSelectedModelIds(newSelection);
  };

  // 5. Launch Viewer
  const handleLaunchViewer = async () => {
    if (selectedModelIds.size === 0) return;
    
    setLoading(true);
    try {
      const modelsToLoad = models.filter(m => selectedModelIds.has(m.id));
      await ViewerService.loadModels(selectedProject, modelsToLoad);
      setView('viewer');
    } catch (err) {
      setError("Failed to initialize viewer.");
    } finally {
      setLoading(false);
    }
  };

  // Back Navigation
  const goBack = () => {
    if (view === 'viewer') setView('models');
    else if (view === 'models') {
      setSelectedProject(null);
      setView('projects');
    }
  };

  // --- RENDERERS ---

  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <Layers className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Trimble Connect Extension</h1>
          <p className="text-gray-500 mb-8">
            Scalable extension architecture demo.<br/>
            {DEMO_MODE ? "(Running in Mock Mode)" : "(Running in Live Mode)"}
          </p>
          
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}

          <Button onClick={handleLogin} disabled={loading} className="w-full" icon={loading ? Loader2 : Box}>
            {loading ? "Connecting..." : "Connect to Trimble"}
          </Button>
        </div>
      </div>
    );
  }

  // Common Header for authenticated views
  const Header = () => (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center space-x-2">
        <div className="bg-blue-600 text-white p-1.5 rounded-md">
          <Layers className="w-5 h-5" />
        </div>
        <span className="font-bold text-gray-800 text-lg">TC Extension</span>
        {selectedProject && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 font-medium">{selectedProject.name}</span>
          </>
        )}
      </div>
      <div className="flex items-center space-x-3">
        {view !== 'projects' && (
          <Button variant="secondary" onClick={goBack} className="text-sm px-3 py-1.5">
            Back
          </Button>
        )}
        {view === 'viewer' && (
           <Button variant="primary" onClick={() => setView('models')} className="text-sm px-3 py-1.5">
             Close Viewer
           </Button>
        )}
      </div>
    </div>
  );

  if (view === 'viewer') {
    return (
      <div className="h-screen flex flex-col bg-gray-900">
        <Header />
        <div className="flex-1 flex items-center justify-center text-white relative">
          {/* In a real app, the 3D Viewer iframe/canvas would go here */}
          <div className="text-center">
            <Layers className="w-24 h-24 text-gray-700 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-light text-gray-300">3D Viewer Initialized</h2>
            <p className="text-gray-500 mt-2">
              Loaded {selectedModelIds.size} model(s) from {selectedProject.name}
            </p>
            <div className="mt-8 p-4 bg-gray-800 rounded-lg text-left max-w-md mx-auto font-mono text-xs text-green-400">
              <p>{`> Initializing Viewer API... OK`}</p>
              <p>{`> Loading Project ID: ${selectedProject.id}... OK`}</p>
              <p>{`> Loading Models: [${Array.from(selectedModelIds).join(', ')}]... OK`}</p>
              <p className="animate-pulse">{`> Rendering Context...`}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            {view === 'projects' ? 'Select a Project' : 'Select Models to View'}
          </h2>
          {view === 'models' && (
            <div className="text-sm text-gray-500">
              {selectedModelIds.size} selected
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : view === 'projects' ? (
          // PROJECT LIST VIEW
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(proj => (
              <Card key={proj.id} onClick={() => handleProjectSelect(proj)} className="group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full text-gray-500">
                    {proj.region}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {proj.name}
                </h3>
                <p className="text-xs text-gray-500">ID: {proj.id}</p>
              </Card>
            ))}
          </div>
        ) : (
          // MODEL LIST VIEW
          <div className="space-y-4">
            {models.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                <p className="text-gray-500">No 3D models found in this project.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                 <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 font-semibold w-12">Select</th>
                        <th className="px-6 py-3 font-semibold">Name</th>
                        <th className="px-6 py-3 font-semibold">Type</th>
                        <th className="px-6 py-3 font-semibold">Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {models.map(model => (
                        <tr 
                          key={model.id} 
                          className={`hover:bg-blue-50 transition-colors cursor-pointer ${selectedModelIds.has(model.id) ? 'bg-blue-50/60' : ''}`}
                          onClick={() => toggleModelSelection(model.id)}
                        >
                          <td className="px-6 py-4">
                            <input 
                              type="checkbox" 
                              checked={selectedModelIds.has(model.id)}
                              onChange={() => {}} // Handled by row click
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900 flex items-center">
                            <FileBox className="w-4 h-4 mr-3 text-gray-400" />
                            {model.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                              {model.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{model.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            <div className="flex justify-end pt-4">
               <Button 
                onClick={handleLaunchViewer} 
                disabled={selectedModelIds.size === 0}
                icon={Eye}
                className="w-full sm:w-auto"
              >
                Open in 3D Viewer ({selectedModelIds.size})
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}