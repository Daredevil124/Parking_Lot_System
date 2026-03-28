import React, { useState, useEffect } from "react";
import {
  Car,
  CreditCard,
  Ticket,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Clock,
  Plus,
  Minus,
  Search,
  LayoutDashboard,
  Map as MapIcon,
  Settings,
  Menu,
  X,
  MapPin,
} from "lucide-react";

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Data State
  const [availableSpots, setAvailableSpots] = useState(0);
  const [spotsData, setSpotsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Setup Data State
  const [setupInfo, setSetupInfo] = useState({
    lots: [],
    floors: [],
    gates: [],
    rates: [],
  });

  // Forms State
  // Check-In / Out State
  const [licensePlate, setLicensePlate] = useState("");
  const [spotType, setSpotType] = useState("CAR");
  const [gateId, setGateId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentMode, setPaymentMode] = useState("CREDIT_CARD");
  const [calculatedFee, setCalculatedFee] = useState(null);

  // Admin & Search State
  const [newSpotType, setNewSpotType] = useState("CAR");
  const [newFloorId, setNewFloorId] = useState("");
  const [newFloorNumber, setNewFloorNumber] = useState("");
  const [newGateType, setNewGateType] = useState("ENTRY");
  const [searchSpotId, setSearchSpotId] = useState("");
  const [searchSpotType, setSearchSpotType] = useState("");
  const [searchLicensePlate, setSearchLicensePlate] = useState("");

  const API_BASE_URL = "http://localhost:8081/api";

  const fetchDashboardData = async (forceSpotsRefresh = false) => {
    try {
      const setupRes = await fetch(`${API_BASE_URL}/setup-info`);
      if (setupRes.ok) {
        const setupData = await setupRes.json();
        setSetupInfo(setupData);
        if (setupData.gates && setupData.gates.length > 0) {
          const entryGates = setupData.gates.filter(
            (g) => g.gateType === "ENTRY" || g.gateType === "ENTRY/EXIT",
          );
          if (entryGates.length > 0) {
            setGateId((prev) => prev || entryGates[0].gateId);
          }
        }
        if (setupData.floors && setupData.floors.length > 0) {
          setNewFloorId((prev) => prev || setupData.floors[0].floorId);
        }
      }

      // Fetch pricing rates
      const ratesRes = await fetch(`${API_BASE_URL}/rates`);
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json();
        setSetupInfo((prev) => ({ ...prev, rates: ratesData }));
      }

      // Always fetch count
      const countRes = await fetch(`${API_BASE_URL}/spots/available`);
      if (countRes.ok) {
        const countData = await countRes.json();
        setAvailableSpots(countData.availableSpots);
      }

      // Only fetch generic spots if forced
      if (forceSpotsRefresh) {
        const spotsRes = await fetch(`${API_BASE_URL}/spots`);
        if (spotsRes.ok) {
          const spots = await spotsRes.json();
          setSpotsData(spots);
        }
      }
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
    // Refresh count periodically, but let searches and actions control the grid
    const interval = setInterval(() => fetchDashboardData(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const showMessage = (msg, isError = false) => {
    if (isError) {
      setError(msg);
      setSuccessMessage(null);
    } else {
      setSuccessMessage(msg);
      setError(null);
    }
    setTimeout(() => {
      setError(null);
      setSuccessMessage(null);
    }, 8000);
  };

  // ---------------------------------------------------------
  // Actions
  // ---------------------------------------------------------
  const handleCheckIn = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licensePlate, spotType, gateId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Check-in failed.");

      showMessage(
        `Vehicle entered successfully. TxID: ${data.transactionId} | Spot: ${data.spotId}`,
      );
      setLicensePlate("");
      fetchDashboardData(true);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateFee = async (e) => {
    if (e) e.preventDefault();
    if (!transactionId) return;
    setIsLoading(true);
    setCalculatedFee(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/checkout/fee?transactionId=${encodeURIComponent(transactionId)}`,
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to calculate fee.");
      setCalculatedFee(data.fee);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transactionId,
          paymentMode: paymentMode,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Check-out failed.");

      showMessage(`Checkout Complete! Total Fee: $${data.fee.toFixed(2)}`);
      setTransactionId("");
      setCalculatedFee(null);
      fetchDashboardData(true);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSpot = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/spots/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 1,
          spotType: newSpotType,
          floorId: newFloorId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add spot.");

      showMessage(data.message || "Spot added successfully.");
      fetchDashboardData(true);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFloor = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/floors/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotId: "L1",
          floorNumber: parseInt(newFloorNumber) || 1,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add floor.");

      showMessage(data.message || "Floor added successfully.");
      setNewFloorNumber("");
      fetchDashboardData(true);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/gates/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lotId: "L1", gateType: newGateType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add gate.");

      showMessage(data.message || "Gate added successfully.");
      fetchDashboardData(true);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSpot = async (spotIdToRemove) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/spots/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotId: spotIdToRemove }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to remove spot.");

      showMessage(data.message || "Spot removed successfully.");
      fetchDashboardData(true);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRate = async (vehicleType, newRate) => {
    if (!newRate || isNaN(newRate) || newRate <= 0) {
      showMessage("Please enter a valid rate greater than 0.", true);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/rates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleType, hourlyRate: parseFloat(newRate) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update rate.");

      showMessage(data.message || "Rate updated successfully.");
      fetchDashboardData(true);
    } catch (err) {
      showMessage(err.message, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (type, value) => {
    if (!value || value.trim() === "") {
      fetchDashboardData(true);
      return;
    }
    try {
      let queryParam = "";
      const encodedValue = encodeURIComponent(value);

      if (type === "spotId") queryParam = `spotId=${encodedValue}`;
      else if (type === "spotType") queryParam = `spotType=${encodedValue}`;
      else if (type === "licensePlate")
        queryParam = `licensePlate=${encodedValue}`;

      const response = await fetch(
        `${API_BASE_URL}/spots/search?${queryParam}`,
      );
      if (response.ok) {
        const data = await response.json();
        setSpotsData(data);
      } else {
        const errData = await response.json();
        showMessage(errData.error || "Search failed.", true);
      }
    } catch (err) {
      showMessage("Search connection failed.", true);
    }
  };

  // ---------------------------------------------------------
  // Render Components
  // ---------------------------------------------------------

  const occupiedSpots = spotsData.length - availableSpots;
  const utilization =
    spotsData.length > 0
      ? Math.round((occupiedSpots / spotsData.length) * 100)
      : 0;

  return (
    <div className="flex h-screen bg-[#F4F7FA] font-sans text-slate-900 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 w-72 bg-slate-900 text-white z-50 transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none`}
      >
        <div className="h-20 flex items-center px-8 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-2 rounded-xl shadow-inner shadow-indigo-500/20">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {setupInfo.lots.length > 0
                  ? setupInfo.lots[0].name
                  : "Smart Park"}
              </h1>
              {setupInfo.lots.length > 0 && (
                <p className="text-sm text-slate-500 font-medium">
                  {setupInfo.lots[0].location}
                </p>
              )}
            </div>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Main Menu
          </p>
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "dashboard"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Control Panel
          </button>
          <button
            onClick={() => {
              setActiveTab("map");
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === "map"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <MapIcon className="w-5 h-5" />
            Live Spot Map
          </button>
        </div>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-300">
              System Online
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-slate-600 hover:text-indigo-600"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 capitalize">
              {activeTab === "dashboard" ? "Control Panel" : "Live Spot Map"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-900">
                Admin User
              </span>
              <span className="text-xs font-medium text-slate-500">
                Lot Manager
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </header>

        {/* Global Toast Notifications */}
        <div className="absolute top-24 right-6 lg:right-10 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
          {error && (
            <div className="bg-white border-l-4 border-rose-500 shadow-xl rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Operation Failed
                </h3>
                <p className="text-sm text-slate-600 mt-1">{error}</p>
              </div>
            </div>
          )}
          {successMessage && (
            <div className="bg-white border-l-4 border-emerald-500 shadow-xl rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-right-8 fade-in duration-300 pointer-events-auto">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Success</h3>
                <p className="text-sm text-slate-600 mt-1">{successMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 pb-24">
          {/* --------------------------- */}
          {/* DASHBOARD VIEW              */}
          {/* --------------------------- */}
          {activeTab === "dashboard" && (
            <div className="space-y-8 max-w-6xl mx-auto animate-in fade-in zoom-in-95 duration-300">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Available Card (Hero) */}
                <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden group">
                  <div className="absolute -right-6 -top-6 text-white/10 group-hover:scale-110 transition-transform duration-500">
                    <Car className="w-32 h-32" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-indigo-100 text-sm font-semibold uppercase tracking-wider mb-2">
                      Available Spots
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black tracking-tighter">
                        {availableSpots}
                      </span>
                      <span className="text-xl text-indigo-200 font-medium">
                        / {spotsData.length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Utilization Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">
                      Lot Utilization
                    </p>
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <LayoutDashboard className="w-5 h-5 text-indigo-600" />
                    </div>
                  </div>
                  <div>
                    <span className="text-4xl font-black text-slate-800">
                      {utilization}%
                    </span>
                    <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${utilization >= 100 ? "bg-rose-500" : utilization > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: `${utilization}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Revenue/Info Card */}
                <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-800 p-6 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay"></div>
                  <div className="relative z-10 flex justify-between items-start">
                    <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">
                      Hourly Rate
                    </p>
                    <div className="p-2 bg-slate-800 rounded-lg">
                      <Clock className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <span className="text-4xl font-black text-white">
                      $5.00
                    </span>
                    <span className="text-slate-400 text-sm ml-2">/ hr</span>
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Auto-calculated on
                      exit
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Forms */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Check-In */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
                    <div className="bg-indigo-100 p-3 rounded-xl">
                      <ArrowRight className="w-6 h-6 text-indigo-700" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        Vehicle Entry
                      </h3>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">
                        Assign spot and generate ticket
                      </p>
                    </div>
                  </div>
                  <form
                    onSubmit={handleCheckIn}
                    className="p-8 flex-1 flex flex-col space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        License Plate Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Car className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          value={licensePlate}
                          onChange={(e) =>
                            setLicensePlate(e.target.value.toUpperCase())
                          }
                          required
                          className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 focus:bg-white transition-all uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
                          placeholder="e.g. ABC-1234"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Spot Designation
                      </label>
                      <select
                        value={spotType}
                        onChange={(e) => setSpotType(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 focus:bg-white transition-all appearance-none cursor-pointer"
                      >
                        <option value="CAR">Car</option>
                        <option value="BIKE">Bike</option>
                        <option value="TRUCK">Truck</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">
                        Entry Gate
                      </label>
                      <select
                        value={gateId}
                        onChange={(e) => setGateId(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 focus:bg-white transition-all appearance-none cursor-pointer"
                      >
                        {setupInfo.gates
                          .filter(
                            (g) =>
                              g.gateType === "ENTRY" ||
                              g.gateType === "ENTRY/EXIT",
                          )
                          .map((gate) => (
                            <option key={gate.gateId} value={gate.gateId}>
                              {gate.gateId} ({gate.gateType})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="pt-4 mt-auto">
                      <button
                        type="submit"
                        disabled={isLoading || availableSpots === 0}
                        className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-base font-bold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 disabled:shadow-none"
                      >
                        {isLoading
                          ? "Processing..."
                          : availableSpots === 0
                            ? "Lot Full"
                            : "Authorize Entry"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Check-Out */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
                    <div className="bg-emerald-100 p-3 rounded-xl">
                      <CreditCard className="w-6 h-6 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        Payment & Exit
                      </h3>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">
                        Process fee and release spot
                      </p>
                    </div>
                  </div>
                  <form
                    onSubmit={handleCheckOut}
                    className="p-8 flex-1 flex flex-col space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Transaction ID
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Ticket className="h-5 w-5 text-slate-400 z-10" />
                        </div>
                        <select
                          value={transactionId}
                          onChange={(e) => {
                            setTransactionId(e.target.value);
                            setCalculatedFee(null);
                          }}
                          required
                          className="block w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 focus:bg-white transition-all appearance-none cursor-pointer"
                        >
                          <option value="" disabled>
                            Select an active ticket
                          </option>
                          {spotsData
                            .filter(
                              (spot) =>
                                spot.isOccupied === "Y" && spot.transactionId,
                            )
                            .map((spot) => (
                              <option
                                key={spot.transactionId}
                                value={spot.transactionId}
                              >
                                {spot.transactionId} - Spot {spot.spotId} (
                                {spot.licensePlate})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 ml-1">
                        Payment Mode
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 focus:ring-4 focus:ring-emerald-600/10 focus:border-emerald-600 focus:bg-white transition-all appearance-none cursor-pointer"
                      >
                        <option value="CREDIT_CARD">Credit Card</option>
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI / Digital</option>
                      </select>
                      <p className="mt-3 text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />{" "}
                        Secure transaction processing
                      </p>
                    </div>

                    {calculatedFee !== null && (
                      <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold text-center border border-emerald-200">
                        Amount Due: ${calculatedFee.toFixed(2)}
                      </div>
                    )}

                    <div className="pt-4 mt-auto border-t border-slate-100 flex gap-3">
                      <button
                        type="button"
                        onClick={handleCalculateFee}
                        disabled={isLoading || !transactionId}
                        className="flex-1 py-4 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-base font-bold transition-all disabled:opacity-50 mt-2"
                      >
                        Calculate Fee
                      </button>
                      <button
                        type="submit"
                        disabled={
                          isLoading || !transactionId || calculatedFee === null
                        }
                        className="flex-1 flex items-center justify-center gap-2 py-4 px-4 bg-slate-900 hover:bg-slate-800 active:bg-black text-white rounded-xl text-base font-bold shadow-lg shadow-slate-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900 disabled:shadow-none mt-2"
                      >
                        Checkout
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------- */}
          {/* MAP / LIVE SPOTS VIEW       */}
          {/* --------------------------- */}
          {activeTab === "map" && (
            <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
              {/* Controls Header */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
                {/* Search Filters */}
                <div className="w-full xl:w-auto flex-1">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">
                    Search Filters
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <div className="relative flex-1 min-w-[160px]">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={searchSpotId}
                        onChange={(e) => {
                          setSearchSpotId(e.target.value);
                          setSearchSpotType("");
                          setSearchLicensePlate("");
                          handleSearch("spotId", e.target.value);
                        }}
                        placeholder="By Spot ID"
                        className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors"
                      />
                    </div>
                    <div className="relative flex-1 min-w-[160px]">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={searchSpotType}
                        onChange={(e) => {
                          setSearchSpotType(e.target.value);
                          setSearchSpotId("");
                          setSearchLicensePlate("");
                          handleSearch("spotType", e.target.value);
                        }}
                        placeholder="By Spot Type"
                        className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors"
                      />
                    </div>
                    <div className="relative flex-1 min-w-[160px]">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Car className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={searchLicensePlate}
                        onChange={(e) => {
                          setSearchLicensePlate(e.target.value);
                          setSearchSpotId("");
                          setSearchSpotType("");
                          handleSearch("licensePlate", e.target.value);
                        }}
                        placeholder="By License Plate"
                        className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="w-full xl:w-auto border-t xl:border-t-0 xl:border-l border-slate-200 pt-6 xl:pt-0 xl:pl-6 flex flex-col gap-5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">
                      Add Spot
                    </h3>
                    <div className="flex items-center gap-3">
                      <select
                        value={newSpotType}
                        onChange={(e) => setNewSpotType(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors cursor-pointer"
                      >
                        <option value="CAR">Car</option>
                        <option value="BIKE">Bike</option>
                        <option value="TRUCK">Truck</option>
                      </select>
                      <select
                        value={newFloorId}
                        onChange={(e) => setNewFloorId(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors cursor-pointer"
                      >
                        {setupInfo.floors.map((floor) => (
                          <option key={floor.floorId} value={floor.floorId}>
                            Floor {floor.floorNumber}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAddSpot}
                        disabled={isLoading || setupInfo.floors.length === 0}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Spot
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">
                        Add Floor
                      </h3>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={newFloorNumber}
                          onChange={(e) => setNewFloorNumber(e.target.value)}
                          placeholder="Floor #"
                          className="w-24 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors"
                        />
                        <button
                          onClick={handleAddFloor}
                          disabled={isLoading || !newFloorNumber}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                          Floor
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">
                        Add Gate
                      </h3>
                      <div className="flex items-center gap-3">
                        <select
                          value={newGateType}
                          onChange={(e) => setNewGateType(e.target.value)}
                          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors cursor-pointer"
                        >
                          <option value="ENTRY">Entry</option>
                          <option value="EXIT">Exit</option>
                          <option value="ENTRY/EXIT">Entry/Exit</option>
                        </select>
                        <button
                          onClick={handleAddGate}
                          disabled={isLoading}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                          Gate
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 mt-5 pt-5">
                      <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">
                        Pricing Rules (Hourly Rate)
                      </h3>
                      <div className="flex flex-col gap-3">
                        {["CAR", "BIKE", "TRUCK"].map((vType) => {
                          const currentRate =
                            setupInfo.rates?.find(
                              (r) => r.vehicleType === vType,
                            )?.hourlyRate || 0;
                          return (
                            <div
                              key={vType}
                              className="flex items-center gap-3"
                            >
                              <span className="text-sm font-bold text-slate-700 w-16">
                                {vType}
                              </span>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                                  $
                                </span>
                                <input
                                  type="number"
                                  step="0.50"
                                  defaultValue={currentRate}
                                  id={`rate-${vType}`}
                                  className="w-24 pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:bg-white transition-colors"
                                />
                              </div>
                              <button
                                onClick={() =>
                                  handleUpdateRate(
                                    vType,
                                    document.getElementById(`rate-${vType}`)
                                      .value,
                                  )
                                }
                                disabled={isLoading}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                              >
                                Update
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Area */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <MapIcon className="w-5 h-5 text-indigo-600" /> Physical
                    Layout
                  </h3>
                  <div className="flex gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>{" "}
                      Available
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <div className="w-3 h-3 rounded-full bg-rose-500"></div>{" "}
                      Occupied
                    </span>
                  </div>
                </div>

                {spotsData.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-700 mb-1">
                      No spots found
                    </h3>
                    <p className="text-slate-500">
                      Adjust your search filters or add a new spot.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {spotsData.map((spot) => (
                      <div
                        key={spot.spotId}
                        className={`relative group rounded-2xl border-2 transition-all duration-300 overflow-hidden flex flex-col ${
                          spot.isOccupied === "Y"
                            ? "bg-slate-50 border-slate-200 shadow-sm"
                            : "bg-white border-indigo-100 hover:border-indigo-400 shadow-md hover:shadow-lg"
                        }`}
                      >
                        {/* Card Header */}
                        <div
                          className={`px-5 py-3 border-b flex justify-between items-center ${spot.isOccupied === "Y" ? "border-slate-200 bg-slate-100/50" : "border-indigo-50 bg-indigo-50/30"}`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                              Spot {spot.spotId}
                            </span>
                            <span
                              className={`text-sm font-bold ${spot.isOccupied === "Y" ? "text-slate-700" : "text-indigo-700"}`}
                            >
                              {spot.spotType}
                            </span>
                          </div>
                          {spot.isOccupied === "Y" ? (
                            <div className="w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-5 flex-1 flex flex-col justify-center">
                          {spot.isOccupied === "Y" ? (
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                <Car className="w-6 h-6 text-slate-500" />
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  License Plate
                                </span>
                                <span className="font-mono text-base font-black text-slate-900 truncate bg-white px-2 py-1 rounded border border-slate-200 inline-block mb-1">
                                  {spot.licensePlate}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                  TxID:{" "}
                                  <span className="text-slate-700">
                                    {spot.transactionId}
                                  </span>
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-2 flex flex-col items-center justify-center h-full">
                              <span className="text-lg font-bold text-emerald-600 mb-1">
                                Available
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                Ready for check-in
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Bar (Only for available spots) */}
                        {spot.isOccupied !== "Y" && (
                          <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-white/90 backdrop-blur-sm border-t border-slate-100 flex justify-center">
                            <button
                              onClick={() => handleRemoveSpot(spot.spotId)}
                              disabled={isLoading}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg text-xs font-bold transition-colors w-full justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" /> Remove Spot
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
