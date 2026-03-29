import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Search, Phone, ExternalLink, MapPin, Users, Zap, Home, DollarSign, Heart, Briefcase, AlertCircle, Star, User, LogOut, History, Settings } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth context
const AuthContext = React.createContext();

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('jax-finder-token');
    if (token) {
      try {
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data);
      } catch (error) {
        localStorage.removeItem('jax-finder-token');
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { email, password });
      const { access_token } = response.data;
      localStorage.setItem('jax-finder-token', access_token);
      await checkAuth();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const register = async (email, full_name, password) => {
    try {
      await axios.post(`${API}/auth/register`, { email, full_name, password });
      return await login(email, password);
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Registration failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('jax-finder-token');
    setUser(null);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem('jax-finder-token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      if (!fullName.trim()) {
        toast.error('Please enter your full name');
        setIsLoading(false);
        return;
      }
      result = await register(email, fullName, password);
    }

    if (result.success) {
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post(`${API}/auth/forgot-password`, { email });
      toast.success('Reset token generated!');
      setResetToken(response.data.reset_token);
      setShowForgotPassword(false);
      setShowResetPassword(true);
    } catch (error) {
      toast.error('Failed to generate reset token');
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post(`${API}/auth/reset-password`, {
        email,
        reset_token: resetToken,
        new_password: newPassword
      });
      toast.success('Password reset successfully! You can now login.');
      setShowResetPassword(false);
      setIsLogin(true);
      setPassword('');
      setNewPassword('');
      setResetToken('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Password reset failed');
    }
    setIsLoading(false);
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-blue-600 to-orange-600 p-3 rounded-lg">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Jacksonville Programs Finder</h1>
            </div>
            <p className="text-gray-600">Reset your password</p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-center">Forgot Password</CardTitle>
              <CardDescription className="text-center">
                Enter your email to receive a reset token
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
                >
                  {isLoading ? 'Generating...' : 'Generate Reset Token'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  Back to sign in
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="bg-gradient-to-r from-blue-600 to-orange-600 p-3 rounded-lg">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Jacksonville Programs Finder</h1>
            </div>
            <p className="text-gray-600">Enter your reset token and new password</p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-center">Reset Password</CardTitle>
              <CardDescription className="text-center">
                Your reset token: <strong className="text-blue-600">{resetToken}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <Label htmlFor="resetToken">Reset Token</Label>
                  <Input
                    id="resetToken"
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    required
                    placeholder="Enter reset token"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Enter new password"
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetPassword(false);
                    setShowForgotPassword(false);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm"
                >
                  Back to sign in
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-orange-600 p-3 rounded-lg">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Jacksonville Programs Finder</h1>
          </div>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to your account' : 'Create your account to get started'}
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">
              {isLogin ? 'Welcome Back' : 'Get Started'}
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin 
                ? 'Sign in to access your search history and manage your subscription'
                : 'Create an account to track your searches and save favorite programs'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    placeholder="Enter your full name"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
              >
                {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
              </Button>
            </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 mb-2">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Link to="/guest" className="text-blue-600 hover:text-blue-700 text-sm">
            Continue as guest (limited features)
          </Link>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, logout, getAuthHeaders } = useAuth();
  const [searchHistory, setSearchHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('search');
  const navigate = useNavigate();

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const response = await axios.get(`${API}/user/search-history`, {
        headers: getAuthHeaders()
      });
      setSearchHistory(response.data);
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
    toast.success('Logged out successfully');
  };

  const handleSubscribe = async () => {
    try {
      await axios.post(`${API}/payment/subscribe`, {}, {
        headers: getAuthHeaders()
      });
      toast.success('Subscription activated! You now have unlimited searches.');
      window.location.reload(); // Reload to update user data
    } catch (error) {
      toast.error('Subscription failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-orange-600 p-2 rounded-lg">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jacksonville Programs Finder</h1>
                <p className="text-sm text-gray-600">Welcome back, {user?.full_name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  Searches: {user?.searches_used || 0}/2 {user?.has_subscription && "(Unlimited)"}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.has_subscription ? 'Premium Member' : 'Free Account'}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100">
            <TabsTrigger value="search" className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Search className="w-4 h-4" />
              <span>Search Programs</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <History className="w-4 h-4" />
              <span>Search History</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Settings className="w-4 h-4" />
              <span>Account</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-8">
            <SearchInterface />
          </TabsContent>

          <TabsContent value="history" className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Your Search History</CardTitle>
                <CardDescription>
                  View your recent searches and results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {searchHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No search history yet. Try searching for programs to get started!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {searchHistory.map((search, index) => (
                      <div key={search.id || index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">"{search.query}"</h3>
                          <span className="text-sm text-gray-500">
                            {new Date(search.search_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{search.search_explanation}</p>
                        <p className="text-xs text-gray-500">
                          Found {search.results_count} programs
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="mt-8">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                    <p className="text-gray-900">{user?.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Email</Label>
                    <p className="text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Member Since</Label>
                    <p className="text-gray-900">
                      {new Date(user?.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Searches Used</Label>
                    <p className="text-gray-900">
                      {user?.searches_used || 0} {user?.has_subscription ? '(Unlimited)' : '/ 2 free'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subscription Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user?.has_subscription ? (
                    <div className="text-center">
                      <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full inline-block mb-4">
                        Premium Member
                      </div>
                      <p className="text-gray-600 mb-4">
                        You have unlimited searches and full access to all programs.
                      </p>
                      <p className="text-sm text-gray-500">
                        Subscribed on: {new Date(user?.subscription_date).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-full inline-block mb-4">
                        Free Account
                      </div>
                      <p className="text-gray-600 mb-4">
                        You have {2 - (user?.searches_used || 0)} free searches remaining.
                      </p>
                      <Button 
                        onClick={handleSubscribe}
                        className="bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
                      >
                        Upgrade to Premium - $1/month
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const SearchInterface = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchExplanation, setSearchExplanation] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const { user, getAuthHeaders } = useAuth();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/search`, {
        query: searchQuery
      }, {
        headers: getAuthHeaders()
      });
      
      setSearchResults(response.data.programs);
      setSearchExplanation(response.data.search_explanation);
      toast.success(`Found ${response.data.total_found} relevant programs!`);
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

  const handleSubscribe = async () => {
    try {
      await axios.post(`${API}/payment/subscribe`, {}, {
        headers: getAuthHeaders()
      });
      setShowPaywall(false);
      toast.success('Subscription activated! You now have unlimited searches.');
      window.location.reload();
    } catch (error) {
      toast.error('Subscription failed. Please try again.');
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
    <div className="space-y-8">
      {/* Search Box */}
      <Card>
        <CardHeader>
          <CardTitle>Search for Assistance Programs</CardTitle>
          <CardDescription>
            Describe what you need in plain English - our AI will find relevant programs for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Try: 'I need help with my electric bill' or 'small business grants'"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="text-lg py-3 pl-12 pr-24"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Button 
              onClick={handleSearch}
              disabled={isLoading}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Suggestions */}
          <div className="flex flex-wrap gap-2">
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
        </CardContent>
      </Card>

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
                <h3 className="font-semibold text-gray-900 mb-2">Premium Membership</h3>
                <p className="text-2xl font-bold text-gray-900">$1.00 <span className="text-sm font-normal text-gray-600">/month</span></p>
                <p className="text-sm text-gray-600 mt-1">Unlimited searches • New programs added regularly • Search history</p>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSubscribe}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700"
                >
                  Subscribe Now
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
        <div>
          {searchExplanation && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-blue-900 mb-2">Why these programs match your search:</h3>
                <p className="text-blue-800">{searchExplanation}</p>
              </CardContent>
            </Card>
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
    </div>
  );
};

const GuestPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-orange-600 p-2 rounded-lg">
                <MapPin className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jacksonville Programs Finder</h1>
                <p className="text-sm text-gray-600">Guest Mode - Limited Features</p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Link to="/auth">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-orange-600">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Preview: Jacksonville Assistance Programs
          </h2>
          <p className="text-xl text-gray-600 mb-6">
            Sign up for unlimited AI-powered search and full access to all programs
          </p>
          
          <Card className="max-w-2xl mx-auto mb-8">
            <CardContent className="pt-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
                  <div className="text-left">
                    <h3 className="font-medium text-yellow-800">Limited Guest Access</h3>
                    <p className="text-sm text-yellow-600 mt-1">
                      Create a free account to access AI-powered search, track your search history, and get 2 free searches per month.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
              <History className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Search History</h3>
            <p className="text-gray-600">Track your searches and easily revisit programs you're interested in.</p>
          </div>
          
          <div className="text-center">
            <div className="bg-gradient-to-r from-blue-600 to-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Affordable Access</h3>
            <p className="text-gray-600">Only $1/month for unlimited searches - making help accessible to everyone.</p>
          </div>
        </div>

        <div className="text-center">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-orange-600 hover:from-blue-700 hover:to-orange-700">
              Get Started - Create Free Account
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<LoginPage />} />
            <Route path="/guest" element={<GuestPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/" element={<Navigate to="/auth" replace />} />
          </Routes>
        </BrowserRouter>
      </div>
      <Toaster />
    </AuthProvider>
  );
}

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-r from-blue-600 to-orange-600 p-3 rounded-lg mb-4 mx-auto w-fit">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return children;
};

export default App;