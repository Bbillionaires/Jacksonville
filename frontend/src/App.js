import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Search, Phone, ExternalLink, MapPin, Users, Zap, Home, DollarSign, Heart, Briefcase, AlertCircle, Star } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Generate a simple session ID
const getSessionId = () => {
  let sessionId = localStorage.getItem('jax-finder-session');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('jax-finder-session', sessionId);
  }
  return sessionId;
};

const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchExplanation, setSearchExplanation] = useState('');
  const [sessionInfo, setSessionInfo] = useState(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const sessionId = getSessionId();

  useEffect(() => {
    loadSessionInfo();
    initializePrograms();
  }, []);

  const initializePrograms = async () => {
    try {
      await axios.post(`${API}/admin/init-programs`);
    } catch (error) {
      console.log('Programs already initialized or error:', error);
    }
  };

  const loadSessionInfo = async () => {
    try {
      const response = await axios.get(`${API}/session/${sessionId}`);
      setSessionInfo(response.data);
    } catch (error) {
      console.error('Error loading session info:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/search?session_id=${sessionId}`, {
        query: searchQuery
      });
      
      setSearchResults(response.data.programs);
      setSearchExplanation(response.data.search_explanation);
      toast.success(`Found ${response.data.total_found} relevant programs!`);
      
      // Refresh session info
      await loadSessionInfo();
    } catch (error) {
      if (error.response?.status === 402) {
        setShowPaywall(true);
        toast.error('Free search limit reached! Please subscribe for unlimited searches.');
      } else {
        toast.error('Search failed. Please try again.');
        console.error('Search error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockPayment = async () => {
    try {
      await axios.post(`${API}/payment/mock-success/${sessionId}`);
      setShowPaywall(false);
      await loadSessionInfo();
      toast.success('Payment successful! You now have unlimited searches.');
    } catch (error) {
      toast.error('Payment failed. Please try again.');
    }
  };

  const getCategoryIcon = (category) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('energy') || categoryLower.includes('utility')) return <Zap className="w-4 h-4" />;
    if (categoryLower.includes('housing') || categoryLower.includes('home')) return <Home className="w-4 h-4" />;
    if (categoryLower.includes('business') || categoryLower.includes('commercial')) return <Briefcase className="w-4 h-4" />;
    if (categoryLower.includes('financial') || categoryLower.includes('assistance')) return <DollarSign className="w-4 h-4" />;
    if (categoryLower.includes('facade')) return <Star className="w-4 h-4" />;
    return <Heart className="w-4 h-4" />;
  };

  const getCategoryColor = (category) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('energy') || categoryLower.includes('utility')) return 'bg-amber-100 text-amber-800';
    if (categoryLower.includes('housing') || categoryLower.includes('home')) return 'bg-blue-100 text-blue-800';
    if (categoryLower.includes('business') || categoryLower.includes('commercial')) return 'bg-purple-100 text-purple-800';
    if (categoryLower.includes('financial') || categoryLower.includes('assistance')) return 'bg-green-100 text-green-800';
    if (categoryLower.includes('facade')) return 'bg-pink-100 text-pink-800';
    return 'bg-gray-100 text-gray-800';
  };

  const searchSuggestions = [
    "I need help paying my electric bill",
    "Small business facade improvement grants",
    "Emergency financial assistance",
    "Energy efficiency rebates for my home",
    "Low income housing assistance",
    "Help with utility bills",
    "Commercial property improvement grants"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-orange-600 p-2 rounded-lg">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jacksonville Programs Finder</h1>
                <p className="text-sm text-gray-600">Find assistance programs in Duval County</p>
              </div>
            </div>
            
            {sessionInfo && (
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Searches: {sessionInfo.searches_used}/2 {sessionInfo.has_paid && "(Unlimited)"}
                </p>
                <p className="text-xs text-gray-500">
                  {typeof sessionInfo.searches_remaining === 'number' 
                    ? `${sessionInfo.searches_remaining} free searches left`
                    : 'Unlimited searches'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Find Government & Community Assistance
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Search for grants, utility help, housing aid, food banks, business incentives, and more - all in one place. 
            Just describe what you need in plain English.
          </p>

          {/* Search Box */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Input
                type="text"
                placeholder="Try: 'I need help with my electric bill' or 'small business grants'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full text-lg py-4 pl-12 pr-24 rounded-2xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Button 
                onClick={handleSearch}
                disabled={isLoading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700 text-white px-6 py-2 rounded-xl transition-all"
              >
                {isLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>

          {/* Search Suggestions */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <p className="w-full text-sm text-gray-500 mb-2">Try these examples:</p>
            {searchSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setSearchQuery(suggestion)}
                className="bg-white hover:bg-gray-50 text-gray-700 px-3 py-1 rounded-full text-sm border border-gray-200 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Paywall Modal */}
        {showPaywall && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center space-x-2">
                  <AlertCircle className="w-6 h-6 text-orange-500" />
                  <span>Unlock Unlimited Searches</span>
                </CardTitle>
                <CardDescription>
                  You've used your 2 free searches. Subscribe for unlimited access to all Jacksonville assistance programs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-orange-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Monthly Subscription</h3>
                  <p className="text-2xl font-bold text-gray-900">$1.00 <span className="text-sm font-normal text-gray-600">/month</span></p>
                  <p className="text-sm text-gray-600 mt-1">Unlimited searches • New programs added regularly • Mobile access</p>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleMockPayment}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
                  >
                    Subscribe Now (Mock Payment)
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowPaywall(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            {searchExplanation && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Search Results Explanation</h3>
                <p className="text-blue-800">{searchExplanation}</p>
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((program) => (
                <Card key={program.id} className="hover:shadow-lg transition-shadow duration-300 border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg leading-tight mb-2">{program.program}</CardTitle>
                        <Badge className={`${getCategoryColor(program.category)} mb-2`}>
                          <div className="flex items-center space-x-1">
                            {getCategoryIcon(program.category)}
                            <span className="text-xs">{program.category}</span>
                          </div>
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="text-sm">
                      <div className="flex items-center text-gray-600 mb-1">
                        <Users className="w-4 h-4 mr-1" />
                        {program.agency}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 mb-1">Eligibility:</h4>
                        <p className="text-sm text-gray-600">{program.eligibility}</p>
                      </div>
                      
                      {program.notes && (
                        <div>
                          <h4 className="font-medium text-sm text-gray-900 mb-1">Benefits:</h4>
                          <p className="text-sm text-gray-600">{program.notes}</p>
                        </div>
                      )}
                      
                      <div className="flex flex-col space-y-2 pt-2">
                        <a
                          href={program.apply_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-all"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Apply Now
                        </a>
                        
                        {program.phone && (
                          <a
                            href={`tel:${program.phone}`}
                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 text-sm font-medium rounded-lg transition-all"
                          >
                            <Phone className="w-4 h-4 mr-2" />
                            {program.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="text-center">
            <div className="bg-gradient-to-r from-blue-600 to-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Search</h3>
            <p className="text-gray-600">Describe your needs in plain English and find relevant programs instantly.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-gradient-to-r from-blue-600 to-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Local Focus</h3>
            <p className="text-gray-600">All programs are specifically for Jacksonville and Duval County residents.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-gradient-to-r from-blue-600 to-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Affordable Access</h3>
            <p className="text-gray-600">Only $1/month for unlimited searches - making help accessible to everyone.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Jacksonville Programs Finder</h3>
            <p className="text-gray-400 mb-4">Connecting residents with assistance programs in Duval County</p>
            <p className="text-sm text-gray-500">
              Not affiliated with the City of Jacksonville. For official information, visit program websites directly.
            </p>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  );
};

const AdminPage = () => {
  const [programs, setPrograms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newProgram, setNewProgram] = useState({
    program: '',
    category: '',
    agency: '',
    eligibility: '',
    apply_url: '',
    phone: '',
    notes: '',
    source: ''
  });

  useEffect(() => {
    loadPrograms();
  }, []);

  const loadPrograms = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/programs`);
      setPrograms(response.data);
    } catch (error) {
      toast.error('Failed to load programs');
      console.error('Error loading programs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProgram = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/programs`, newProgram);
      toast.success('Program added successfully!');
      setNewProgram({
        program: '',
        category: '',
        agency: '',
        eligibility: '',
        apply_url: '',
        phone: '',
        notes: '',
        source: ''
      });
      loadPrograms();
    } catch (error) {
      toast.error('Failed to add program');
      console.error('Error adding program:', error);
    }
  };

  const handleDeleteProgram = async (programId) => {
    if (window.confirm('Are you sure you want to delete this program?')) {
      try {
        await axios.delete(`${API}/programs/${programId}`);
        toast.success('Program deleted successfully');
        loadPrograms();
      } catch (error) {
        toast.error('Failed to delete program');
        console.error('Error deleting program:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage Jacksonville assistance programs</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add New Program Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add New Program</CardTitle>
            <CardDescription>Enter details for a new assistance program</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddProgram} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Program Name</label>
                <Input
                  value={newProgram.program}
                  onChange={(e) => setNewProgram({...newProgram, program: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <Input
                  value={newProgram.category}
                  onChange={(e) => setNewProgram({...newProgram, category: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Agency</label>
                <Input
                  value={newProgram.agency}
                  onChange={(e) => setNewProgram({...newProgram, agency: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <Input
                  value={newProgram.phone}
                  onChange={(e) => setNewProgram({...newProgram, phone: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Eligibility</label>
                <Input
                  value={newProgram.eligibility}
                  onChange={(e) => setNewProgram({...newProgram, eligibility: e.target.value})}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Apply URL</label>
                <Input
                  type="url"
                  value={newProgram.apply_url}
                  onChange={(e) => setNewProgram({...newProgram, apply_url: e.target.value})}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Notes</label>
                <Input
                  value={newProgram.notes}
                  onChange={(e) => setNewProgram({...newProgram, notes: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source</label>
                <Input
                  value={newProgram.source}
                  onChange={(e) => setNewProgram({...newProgram, source: e.target.value})}
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">Add Program</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Programs List */}
        <Card>
          <CardHeader>
            <CardTitle>Current Programs ({programs.length})</CardTitle>
            <CardDescription>Manage existing assistance programs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Loading programs...</p>
            ) : (
              <div className="space-y-4">
                {programs.map((program) => (
                  <div key={program.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{program.program}</h3>
                        <p className="text-sm text-gray-600">{program.agency}</p>
                        <Badge className="mt-1">{program.category}</Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteProgram(program.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Toaster />
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;