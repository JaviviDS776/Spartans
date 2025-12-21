import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut 
} from 'firebase/auth';
import { 
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    doc, 
    collection, 
    onSnapshot, 
    query, 
    setDoc,
    where,
    getDocs,
    deleteDoc,
    serverTimestamp,
    addDoc,
    updateDoc,
    increment
} from 'firebase/firestore';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Radar as RechartRadar, Tooltip } from 'recharts';
import { Settings, Users, Calendar, LogIn, ChevronLeft, Trash2, Plus, AlertTriangle, Loader, Volleyball, CheckCircle, Zap, Shield, User, X, Power, Heart, Check, RotateCw, Trophy, RotateCcw, Briefcase, Ruler, Scale, Activity, Crosshair, Minus, Map as MapIcon, Upload as UploadIcon, LogOut, Search, GripVertical, History, WifiOff, Phone, CalendarDays, Hash, Hand, Expand, Pencil, ClipboardList, CloudRain, CreditCard, ArrowLeftRight, Layout, RefreshCw, Shirt, Dumbbell, Medal } from 'lucide-react';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

const appId = import.meta.env.VITE_APP_ID; 
const initialAuthToken = null;

// --- 2. CONSTANTES Y REFERENCIAS ---
const getCollections = (userId) => {
    const base = `artifacts/${appId}/users/${userId}`;
    return {
        JUGADORES: `${base}/jugadores`,
        PARTIDOS: `${base}/partidos`,
        TIPOS_SAQUE: `${base}/tipos_saque`,
        SAQUES: `${base}/saques`, 
        ATAQUES: `${base}/ataques`, 
        BLOQUEOS: `${base}/bloqueos`, 
        RECEPCIONES: `${base}/recepciones`, 
        DEFENSAS: `${base}/defensas`,
        COLOCACION: `${base}/colocacion`, 
        ACTITUD: `${base}/actitud`, 
        ESTADISTICAS_GLOBALES: `${base}/estadisticas_globales`, 
        ESTADISTICAS_ENTRENAMIENTO: `${base}/estadisticas_entrenamiento`, 
        ALINEACIONES: `${base}/alineaciones`, 
        STAFF: `${base}/staff`, 
        ENTRENAMIENTOS: `${base}/entrenamientos`, 
        PAGOS: `${base}/pagos`, 
    };
};

const CATEGORIAS = ['Infantil', 'Juvenil Menor', 'Juvenil Mayor', 'Libre (3ra edad)'];
const RAMAS = ['Varonil', 'Femenil'];

const initialPlayers = [];

const initialMatches = [];

const initialServeTypes = [{ id: 'ts1', nombre: 'Potencia' }, { id: 'ts2', nombre: 'Flotado' }, { id: 'ts3', nombre: 'Estático' }];

// --- 3. HELPERS ---
const rotateLineupClockwise = (lineup) => {
    if (!lineup) return {};
    return { pos1: lineup.pos2, pos6: lineup.pos1, pos5: lineup.pos6, pos4: lineup.pos5, pos3: lineup.pos4, pos2: lineup.pos3 };
};

const getRoleColor = (posicion) => {
    const ROLE_COLORS = {
        'Armador': { bg: 'bg-blue-900/40', border: 'border-blue-500/50', text: 'text-blue-200' },
        'Central': { bg: 'bg-red-900/40', border: 'border-red-500/50', text: 'text-red-200' },
        'Opuesto': { bg: 'bg-purple-900/40', border: 'border-purple-500/50', text: 'text-purple-200' },
        'Punta': { bg: 'bg-orange-900/40', border: 'border-orange-500/50', text: 'text-orange-200' },
        'Líbero': { bg: 'bg-emerald-900/40', border: 'border-emerald-500/50', text: 'text-emerald-200' },
        'Default': { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-300' }
    };
    return ROLE_COLORS[posicion] || ROLE_COLORS['Default'];
};

const calculateAge = (birthDateString) => {
    if (!birthDateString) return 'N/A';
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

// --- 4. HOOK DE FIREBASE ---
function useFirebase() {
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState(null);
    const [userPhoto, setUserPhoto] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [error, setError] = useState(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Listener para estado de red (UI)
    useEffect(() => {
        const handleStatusChange = () => setIsOffline(!navigator.onLine);
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    useEffect(() => {
        let unsubscribeAuth = null;

        const initAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } 
            } catch (e) {
                console.warn("Auth Init Error:", e);
                setError("Auth Init Error: " + e.message);
            }
        };
        initAuth();

        unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) { 
                setUserId(user.uid); 
                setUserName(user.displayName || 'Usuario');
                setUserPhoto(user.photoURL);
            } else {
                setUserId(null);
                setUserName(null);
                setUserPhoto(null);
            }
            setIsAuthReady(true); 
        });

        return () => {
            if (unsubscribeAuth) unsubscribeAuth();
        };
    }, []);

    const loginWithGoogle = async () => {
        if (!auth) return;
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (e) {
            console.error("Login failed", e);
            if (e.code === 'auth/unauthorized-domain' || e.code === 'auth/network-request-failed') {
                alert("⚠️ Error de conexión o dominio no autorizado.\n\nIntentando modo INVITADO (Anónimo) para acceso local.");
                try {
                    await signInAnonymously(auth);
                } catch (anonError) {
                    setError("No se pudo iniciar sesión ni siquiera anónimamente: " + anonError.message);
                }
            } else {
                setError("Error al iniciar sesión: " + e.message);
            }
        }
    };

    const logout = async () => {
        if (!auth) return;
        try { await signOut(auth); } catch (e) { console.error(e); }
    };

    const initializeData = useCallback(async (currentUserId) => {
        if (!db || !currentUserId) return;
        const collections = getCollections(currentUserId);
        const checkAndPopulate = async (colName, data) => {
            try {
                const s = await getDocs(collection(db, colName));
                if (s.empty) {
                    for (const item of data) await setDoc(doc(db, colName, item.id), { ...item, createdAt: serverTimestamp(), createdBy: currentUserId });
                }
            } catch(e) { console.error("Populate Error (posiblemente offline)", e); }
        };
        
        if (navigator.onLine) {
            await checkAndPopulate(collections.JUGADORES, initialPlayers);
            await checkAndPopulate(collections.PARTIDOS, initialMatches);
            await checkAndPopulate(collections.TIPOS_SAQUE, initialServeTypes);
        }
    }, []);

    useEffect(() => { if (userId && isAuthReady) initializeData(userId); }, [userId, isAuthReady, initializeData]);
    
    return { db, auth, userId, userName, userPhoto, isAuthReady, error, loginWithGoogle, logout, isOffline };
}

// --- 5. FUNCIONES DE BASE DE DATOS (ACTUALIZADAS PARA ENTRENAMIENTO) ---
const handleGlobalStatsUpdate = async (db, userId, playerId, statType, resultType, isTraining = false) => {
    if (!db || !userId || !playerId) return;
    const collections = getCollections(userId);

    const targetCollection = isTraining ? collections.ESTADISTICAS_ENTRENAMIENTO : collections.ESTADISTICAS_GLOBALES;

    const map = {
        'SAQUE_ACE': 'saques_aces', 'SAQUE_MALO': 'saques_errores', 'SAQUE_BUENO': 'saques_buenos',
        'ATAQUE_BUENO': 'ataques_buenos', 'ATAQUE_MALO': 'ataques_malos', 'ATAQUE_DEFENDIDO': 'ataques_defendidos', 'ATAQUE_BLOQUEADO': 'ataques_bloqueados',
        'BLOQUEO_DIRECTO': 'bloqueos_directos', 'BLOQUEO_ROZE': 'bloqueos_roze', 'BLOQUEO_USADO': 'bloqueos_usado_otro_equipo', 'BLOQUEO_RED': 'bloqueos_usado_otro_equipo',
        'RECEPCION_BUENA': 'recepciones_buenas', 'RECEPCION_REGULAR': 'recepciones_regulares', 'RECEPCION_MALA': 'recepciones_malas',
        'DEFENSA_BUENA': 'defensas_buenas', 'DEFENSA_REGULAR': 'defensas_regulares', 'DEFENSA_FALLIDA': 'defensas_malas',
        'COLOCACION_PERFECTA': 'colocacion_perfecta', 'COLOCACION_BUENA': 'colocacion_buena', 'COLOCACION_ERROR': 'colocacion_mala',
        'ACTITUD_PERFECTA': 'actitud_perfecta', 'ACTITUD_BUENA': 'actitud_buena', 'ACTITUD_REGULAR': 'actitud_regular', 'ACTITUD_MALA': 'actitud_mala', 'ACTITUD_PÉSIMA': 'actitud_pesima'
    };
    const field = map[`${statType}_${resultType}`];
    if (field) {
        try {
            await setDoc(doc(db, targetCollection, playerId), { jugador_id: playerId, [field]: increment(1) }, { merge: true });
        } catch(e) { console.error("Stats Update Error", e); }
    }
};

const handleRegisterEvent = async (db, userId, contextId, playerId, statType, resultType, extraData = {}, isTraining = false) => {
    if (!db || !userId || !playerId) return;
    const collections = getCollections(userId);
    const colName = { 'SAQUE': collections.SAQUES, 'ATAQUE': collections.ATAQUES, 'BLOQUEO': collections.BLOQUEOS, 'RECEPCION': collections.RECEPCIONES, 'DEFENSA': collections.DEFENSAS, 'COLOCACION': collections.COLOCACION, 'ACTITUD': collections.ACTITUD }[statType];
    
    const idField = isTraining ? { entrenamiento_id: contextId } : { partido_id: contextId };

    if (colName) {
        try {
            await addDoc(collection(db, colName), { 
                ...idField, 
                jugador_id: playerId, 
                resultado: resultType, 
                contexto: isTraining ? 'ENTRENAMIENTO' : 'PARTIDO',
                createdAt: serverTimestamp(), 
                createdBy: userId, 
                ...extraData 
            });
            await handleGlobalStatsUpdate(db, userId, playerId, statType, resultType, isTraining);
        } catch(e) { console.error("Register Event Error", e); }
    }
};

// --- 6. COMPONENTES UI GLOBALES ---
const LoadingIndicator = () => <div className="flex flex-col items-center justify-center p-8 text-red-500"><Loader className="w-8 h-8 animate-spin" /><p className="mt-2 text-gray-300">Cargando...</p></div>;

const Toast = ({ message, type, onClose }) => {
    useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
    const bg = type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-emerald-600' : 'bg-gray-700');
    return (
        <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 ${bg} text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center animate-fade-in-up border border-white/10`}>
            {type === 'success' ? <CheckCircle className="w-5 h-5 mr-2"/> : (type === 'error' ? <AlertTriangle className="w-5 h-5 mr-2"/> : null)}
            <span className="font-bold text-sm">{message}</span>
        </div>
    );
};

const StatCard = ({ icon: Icon, title, value, color }) => (
    <div className={`p-4 rounded-xl shadow border border-gray-700 ${color} bg-opacity-90 text-white flex items-center`}>
        <Icon className="w-6 h-6 opacity-80" /><div className="ml-3"><p className="text-xs uppercase opacity-80 font-bold">{title}</p><p className="text-xl font-bold">{value}</p></div>
    </div>
);

// PANTALLA DE LOGIN
const LoginScreen = ({ onLogin, isOffline }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-red-950 p-4 text-white">
        <div className="bg-gray-800 border border-gray-700 text-gray-100 p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
            <div className="bg-red-900/20 border border-red-500/30 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                <Volleyball className="w-12 h-12 text-red-500" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">VoleyStats <span className="text-red-500">PRO</span></h1>
            <p className="text-gray-400 mb-8">Estadísticas de alto rendimiento</p>
            
            <button 
                onClick={onLogin}
                className="w-full flex items-center justify-center bg-white hover:bg-gray-100 text-gray-900 p-4 rounded-xl font-bold transition shadow-lg group"
            >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6 mr-3" alt="Google" />
                <span>Entrar con Google</span>
            </button>
            
            {isOffline && (
                <div className="mt-4 p-2 bg-yellow-900/30 border border-yellow-700 rounded-lg text-yellow-500 text-xs flex items-center justify-center">
                    <WifiOff className="w-3 h-3 mr-2" /> Sin conexión: se intentará acceso offline si ya iniciaste sesión antes.
                </div>
            )}
            
            <p className="mt-6 text-xs text-gray-500">Tus datos seguros en la nube de Reyes Spartans.</p>
        </div>
    </div>
);


// --- 7. MODALES ---

const AddPlayerModal = ({ db, userId, isOpen, onClose, showToast, playerToEdit }) => {
    const defaultData = { 
        nombre: '', 
        posicion: 'Punta', 
        numero: '', 
        altura: '', 
        fotografia: '', 
        peso: '', 
        alcance_ataque: '', 
        alcance_bloqueo: '',
        fecha_nacimiento: '',
        envergadura: '',
        categoria: CATEGORIAS[2], // Default Juvenil Mayor
        rama: RAMAS[0], // Default Varonil
        mano_dominante: 'Diestro',
        fecha_ingreso: '',
        telefono: ''
    };
    
    const [formData, setFormData] = useState(defaultData);
    const [isSaving, setIsSaving] = useState(false);
    
    useEffect(() => {
        if (isOpen) {
            if (playerToEdit) {
                setFormData({
                    ...defaultData,
                    ...playerToEdit,
                    // Asegurar que campos opcionales no sean undefined
                    altura: playerToEdit.altura || '',
                    peso: playerToEdit.peso || '',
                    alcance_ataque: playerToEdit.alcance_ataque || '',
                    alcance_bloqueo: playerToEdit.alcance_bloqueo || '',
                    envergadura: playerToEdit.envergadura || '',
                    rama: playerToEdit.rama || RAMAS[0],
                    categoria: playerToEdit.categoria || CATEGORIAS[2],
                });
            } else {
                setFormData(defaultData);
            }
        }
    }, [isOpen, playerToEdit]);

    if (!isOpen) return null;
    
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 800 * 1024) return alert("Imagen muy pesada (max 800KB)");
            const reader = new FileReader();
            reader.onloadend = () => setFormData(p => ({ ...p, fotografia: reader.result }));
            reader.readAsDataURL(file);
        }
    };
    
    const save = async () => {
        if (!formData.nombre || !formData.numero) return alert('Datos incompletos');
        setIsSaving(true);
        const dataToSave = { 
            ...formData, 
            altura: parseFloat(formData.altura)||null, 
            peso: parseFloat(formData.peso)||null, 
            alcance_ataque: parseFloat(formData.alcance_ataque)||null, 
            alcance_bloqueo: parseFloat(formData.alcance_bloqueo)||null, 
            envergadura: parseFloat(formData.envergadura)||null,
        };

        try {
            if (playerToEdit) {
                await updateDoc(doc(db, getCollections(userId).JUGADORES, playerToEdit.id), {
                    ...dataToSave,
                    updatedAt: serverTimestamp()
                });
                showToast("Jugador actualizado", "success");
            } else {
                await addDoc(collection(db, getCollections(userId).JUGADORES), { 
                    ...dataToSave, 
                    createdAt: serverTimestamp(), 
                    createdBy: userId 
                });
                showToast("Jugador creado correctamente", "success");
            }
            onClose(); 
        } catch (e) { console.error(e); showToast("Error al guardar", "error"); } finally { setIsSaving(false); }
    };

    const handleDelete = async () => {
        if (confirm("¿Estás seguro de que quieres eliminar a este jugador? Esta acción no se puede deshacer.")) {
            try {
                await deleteDoc(doc(db, getCollections(userId).JUGADORES, playerToEdit.id));
                showToast("Jugador eliminado", "success");
                onClose();
            } catch (e) { console.error(e); showToast("Error al eliminar", "error"); }
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-gray-100">
                <div className="p-4 bg-red-700 text-white flex justify-between items-center sticky top-0 z-10 shadow-md">
                    <h3 className="font-bold text-lg flex items-center">
                        <User className="mr-2 w-5 h-5"/> {playerToEdit ? 'Editar Jugador' : 'Nuevo Jugador'}
                    </h3>
                    <button onClick={onClose}><X/></button>
                </div>
                
                <div className="p-6 space-y-6">
                    {/* Foto y Datos Principales */}
                    <div className="flex flex-col sm:flex-row gap-6 items-center">
                        <div className="w-32 h-32 flex-shrink-0 rounded-full bg-gray-700 border-dashed border-2 border-gray-500 flex items-center justify-center relative overflow-hidden group">
                            {formData.fotografia ? <img src={formData.fotografia} className="w-full h-full object-cover"/> : <User className="text-gray-400 w-12 h-12"/>}
                            <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
                                <UploadIcon className="text-white w-8 h-8"/>
                            </label>
                        </div>
                        <div className="flex-grow w-full space-y-3">
                            <input className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white placeholder-gray-400 focus:border-red-500 outline-none" placeholder="Nombre Completo" value={formData.nombre} onChange={e=>setFormData({...formData, nombre:e.target.value})}/>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Número</label>
                                    <input type="number" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" placeholder="#" value={formData.numero} onChange={e=>setFormData({...formData, numero:e.target.value})}/>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-400 font-bold uppercase">Posición</label>
                                    <select className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" value={formData.posicion} onChange={e=>setFormData({...formData, posicion:e.target.value})}>
                                        {['Punta','Central','Líbero','Armador','Opuesto'].map(p=><option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Users className="w-3 h-3 mr-1"/> Rama (Género)</label>
                                    <div className="flex gap-2 mt-1">
                                        {RAMAS.map(r => (
                                            <button 
                                                key={r}
                                                onClick={() => setFormData({...formData, rama: r})}
                                                className={`flex-1 py-2 text-xs font-bold rounded border ${formData.rama === r ? 'bg-red-600 border-red-600 text-white' : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Datos Personales */}
                    <div>
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Datos Personales</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><CalendarDays className="w-3 h-3 mr-1"/> Fecha Nacimiento</label>
                                <input type="date" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" value={formData.fecha_nacimiento} onChange={e=>setFormData({...formData, fecha_nacimiento:e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Phone className="w-3 h-3 mr-1"/> Teléfono</label>
                                <input type="tel" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" placeholder="Opcional" value={formData.telefono} onChange={e=>setFormData({...formData, telefono:e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Briefcase className="w-3 h-3 mr-1"/> Fecha Ingreso</label>
                                <input type="date" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" value={formData.fecha_ingreso} onChange={e=>setFormData({...formData, fecha_ingreso:e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Hash className="w-3 h-3 mr-1"/> Categoría</label>
                                <select className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" value={formData.categoria} onChange={e=>setFormData({...formData, categoria:e.target.value})}>
                                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Físico y Técnico */}
                    <div>
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest border-b border-gray-700 pb-1 mb-3">Perfil Físico y Técnico</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Ruler className="w-3 h-3 mr-1"/> Altura (m)</label>
                                <input type="number" step="0.01" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" placeholder="1.80" value={formData.altura} onChange={e=>setFormData({...formData, altura:e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Scale className="w-3 h-3 mr-1"/> Peso (kg)</label>
                                <input type="number" step="0.1" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" placeholder="75" value={formData.peso} onChange={e=>setFormData({...formData, peso:e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Hand className="w-3 h-3 mr-1"/> Mano Dom.</label>
                                <select className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" value={formData.mano_dominante} onChange={e=>setFormData({...formData, mano_dominante:e.target.value})}>
                                    <option value="Diestro">Diestro</option>
                                    <option value="Zurdo">Zurdo</option>
                                    <option value="Ambidextro">Ambidextro</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Expand className="w-3 h-3 mr-1"/> Envergadura</label>
                                <input type="number" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" placeholder="cm" value={formData.envergadura} onChange={e=>setFormData({...formData, envergadura:e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Activity className="w-3 h-3 mr-1"/> Alc. Ataque</label>
                                <input type="number" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" placeholder="cm" value={formData.alcance_ataque} onChange={e=>setFormData({...formData, alcance_ataque:e.target.value})}/>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-bold uppercase flex items-center"><Shield className="w-3 h-3 mr-1"/> Alc. Bloqueo</label>
                                <input type="number" className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" placeholder="cm" value={formData.alcance_bloqueo} onChange={e=>setFormData({...formData, alcance_bloqueo:e.target.value})}/>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                        {playerToEdit && (
                            <button onClick={handleDelete} className="bg-gray-700 hover:bg-gray-600 text-red-500 p-3 rounded-lg font-bold transition">
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button onClick={save} disabled={isSaving} className="flex-1 bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold transition shadow-lg">
                            {isSaving ? 'Guardando...' : (playerToEdit ? 'ACTUALIZAR JUGADOR' : 'GUARDAR JUGADOR')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AddMatchModal = ({ db, userId, isOpen, onClose, showToast }) => {
    const [data, setData] = useState({ rival: '', lugar: '', fecha: '', alineacion: '' });
    const [lineups, setLineups] = useState([]);
    const collections = getCollections(userId);

    useEffect(() => { 
        if(db && userId && isOpen) {
            const unsub = onSnapshot(query(collection(db, collections.ALINEACIONES)), 
                s => setLineups(s.docs.map(d=>({id:d.id,...d.data()}))), 
                e => console.error("Lineup Error", e)
            );
            return () => unsub();
        } 
    }, [db, userId, isOpen]);
    if (!isOpen) return null;
    const save = async () => {
        if(!data.rival || !data.fecha || !data.alineacion) return alert("Faltan datos");
        const lineup = lineups.find(l=>l.id===data.alineacion);
        
        // Determinar si hay un libero en la alineación guardada para el partido
        const liberoId = lineup.libero || null; 

        try {
            await addDoc(collection(db, collections.PARTIDOS), { 
                equipo_rival: data.rival, 
                lugar: data.lugar, 
                fecha: data.fecha.replace('T', ' '), 
                alineacion_id: data.alineacion, 
                alineacion_data: lineup.formacion, 
                libero_id: liberoId, // Guardar el libero también
                is_completed: false, 
                createdAt: serverTimestamp(), 
                createdBy: userId 
            });
            showToast("Partido programado", "success");
            onClose(); setData({ rival: '', lugar: '', fecha: '', alineacion: '' });
        } catch (e) { console.error("Error creating match", e); }
    };
    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg p-6 space-y-4 text-gray-100">
                <div className="flex justify-between items-center"><h3 className="font-bold text-xl text-red-500">Nuevo Partido</h3><button onClick={onClose}><X className="text-gray-400"/></button></div>
                <input className="w-full bg-gray-700 border-gray-600 border p-3 rounded text-white placeholder-gray-400" placeholder="Nombre del Rival" value={data.rival} onChange={e=>setData({...data, rival:e.target.value})}/>
                <input type="datetime-local" className="w-full bg-gray-700 border-gray-600 border p-3 rounded text-white placeholder-gray-400" value={data.fecha} onChange={e=>setData({...data, fecha:e.target.value})}/>
                <input className="w-full bg-gray-700 border-gray-600 border p-3 rounded text-white placeholder-gray-400" placeholder="Lugar del encuentro" value={data.lugar} onChange={e=>setData({...data, lugar:e.target.value})}/>
                <select className="w-full bg-gray-700 border-gray-600 border p-3 rounded text-white" value={data.alineacion} onChange={e=>setData({...data, alineacion:e.target.value})}><option value="">Seleccionar Alineación Inicial</option>{lineups.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
                <button onClick={save} className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold shadow-lg shadow-red-900/50">CREAR PARTIDO</button>
            </div>
        </div>
    );
};

const AddStaffModal = ({ db, userId, isOpen, onClose }) => {
    const [formData, setFormData] = useState({ nombre: '', puesto: 'Entrenador Principal', edad: '' });
    const collections = getCollections(userId);
    if (!isOpen) return null;
    const save = async () => {
        if (!formData.nombre || !formData.puesto) return alert("Faltan datos");
        try {
            await addDoc(collection(db, collections.STAFF), { ...formData, createdAt: serverTimestamp(), createdBy: userId });
            onClose(); setFormData({ nombre: '', puesto: 'Entrenador Principal', edad: '' });
        } catch(e) { console.error("Staff Save Error", e); }
    };
    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg p-4 space-y-3 text-white">
                <h3 className="font-bold text-red-500">Añadir Staff</h3>
                <input className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white placeholder-gray-400" placeholder="Nombre" value={formData.nombre} onChange={e=>setFormData({...formData, nombre:e.target.value})}/>
                <select className="w-full bg-gray-700 border-gray-600 border p-2 rounded text-white" value={formData.puesto} onChange={e=>setFormData({...formData, puesto:e.target.value})}>{['Entrenador Principal', 'Asistente', 'Fisioterapeuta', 'Preparador Físico', 'Estadístico', 'Otro'].map(p=><option key={p} value={p}>{p}</option>)}</select>
                <button onClick={save} className="w-full bg-red-600 text-white p-2 rounded font-bold">Guardar</button>
            </div>
        </div>
    );
};

const PlayerStatsModal = ({ isOpen, onClose, player, db, userId }) => {
    const [serveZones, setServeZones] = useState({});
    const [servePoints, setServePoints] = useState([]);
    const [stats, setStats] = useState({});
    const [viewMode, setViewMode] = useState('PARTIDO');
    const collections = getCollections(userId);

    useEffect(() => {
        if (!isOpen || !player || !db || !userId) return;
        const targetCollection = viewMode === 'ENTRENAMIENTO' ? collections.ESTADISTICAS_ENTRENAMIENTO : collections.ESTADISTICAS_GLOBALES;
        const docRef = doc(db, targetCollection, player.id);
        const unsubscribeStats = onSnapshot(docRef, (docSnap) => setStats(docSnap.exists() ? docSnap.data() : {}));
        return () => unsubscribeStats();
    }, [isOpen, player, db, userId, viewMode]);

    useEffect(() => {
        if (!isOpen || !player || !db || !userId) return;
        const q = query(collection(db, collections.SAQUES), where("jugador_id", "==", player.id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const zones = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }; const points = [];
            snapshot.docs.forEach(doc => { 
                const d = doc.data(); 
                if (viewMode === 'ENTRENAMIENTO' && d.contexto !== 'ENTRENAMIENTO') return;
                if (viewMode === 'PARTIDO' && d.contexto === 'ENTRENAMIENTO') return;
                if (d.zona) zones[d.zona] = (zones[d.zona] || 0) + 1; 
                if (d.x_percent) points.push({ x: d.x_percent, y: d.y_percent, res: d.resultado }); 
            });
            setServeZones(zones); setServePoints(points);
        }, (e) => console.error("Serve Stats Error", e));
        return () => unsubscribe();
    }, [isOpen, player, db, userId, viewMode]);

    if (!isOpen || !player) return null;
    const calc = (g, t) => t > 0 ? Math.round((g/t)*100) : 0;
    
    const tAtk = (stats.ataques_buenos||0)+(stats.ataques_malos||0)+(stats.ataques_defendidos||0)+(stats.ataques_bloqueados||0);
    const tSaq = (stats.saques_aces||0)+(stats.saques_errores||0)+(stats.saques_buenos||0);
    const tBlo = (stats.bloqueos_directos||0)+(stats.bloqueos_roze||0)+(stats.bloqueos_usado_otro_equipo||0);
    const tRec = (stats.recepciones_buenas||0)+(stats.recepciones_regulares||0)+(stats.recepciones_malas||0);
    const tDef = (stats.defensas_buenas||0)+(stats.defensas_regulares||0)+(stats.defensas_malas||0);
    const tCol = (stats.colocacion_perfecta||0)+(stats.colocacion_buena||0)+(stats.colocacion_mala||0);

    const data = [
        { stat: 'Ataque', val: calc(stats.ataques_buenos||0, tAtk), full: 100 }, 
        { stat: 'Saque', val: calc(stats.saques_aces||0, tSaq), full: 100 }, 
        { stat: 'Bloqueo', val: calc((stats.bloqueos_directos||0)+(stats.bloqueos_roze||0), tBlo), full: 100 },
        { stat: 'Recepción', val: calc((stats.recepciones_buenas||0)+(stats.recepciones_regulares||0), tRec), full: 100 },
        { stat: 'Defensa', val: calc((stats.defensas_buenas||0)+(stats.defensas_regulares||0), tDef), full: 100 },
        { stat: 'Actitud', val: calc((stats.actitud_perfecta||0)+(stats.actitud_buena||0), (stats.actitud_perfecta||0)+(stats.actitud_buena||0)+(stats.actitud_regular||0)+(stats.actitud_mala||0)+(stats.actitud_pesima||0)), full: 100 }
    ];

    if (['Armador', 'Líbero'].includes(player.posicion)) {
        data.push({ stat: 'Colocación', val: calc((stats.colocacion_perfecta||0)+(stats.colocacion_buena||0), tCol), full: 100 });
    }
    
    const maxZone = Math.max(...Object.values(serveZones), 1);
    const getAlpha = (c) => (c / maxZone) * 0.8; 
    const age = calculateAge(player.fecha_nacimiento);

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl p-6 max-h-[95vh] overflow-y-auto text-gray-100 shadow-2xl" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between mb-4 items-start border-b border-gray-700 pb-4">
                    <div className="flex items-center">
                        <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden border-2 border-red-600 mr-4">
                            {player.fotografia ? <img src={player.fotografia} className="w-full h-full object-cover"/> : <User className="w-10 h-10 m-3 text-gray-500"/>}
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{player.nombre}</h2>
                            <div className="flex gap-2 mt-1">
                                <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">#{player.numero}</span>
                                <span className="bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded border border-gray-600">{player.posicion}</span>
                                <span className="bg-gray-700 text-gray-300 text-xs font-bold px-2 py-0.5 rounded border border-gray-600">{age} Años</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-white"/></button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-4 md:col-span-1">
                        <div className="bg-gray-700/30 border border-gray-600 p-4 rounded-xl">
                            <h3 className="font-bold mb-3 text-red-400 text-sm uppercase tracking-widest flex items-center"><Briefcase className="w-4 h-4 mr-2"/> Ficha Técnica</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between border-b border-gray-700 pb-1"><span>Categoría:</span> <span className="font-bold text-white">{player.categoria || 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-1"><span>Mano:</span> <span className="font-bold text-white">{player.mano_dominante || 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-1"><span>Altura:</span> <span className="font-bold text-white">{player.altura ? `${player.altura} m` : 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-1"><span>Peso:</span> <span className="font-bold text-white">{player.peso ? `${player.peso} kg` : 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-1"><span>Envergadura:</span> <span className="font-bold text-white">{player.envergadura ? `${player.envergadura} cm` : 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-1"><span>Alc. Ataque:</span> <span className="font-bold text-white">{player.alcance_ataque ? `${player.alcance_ataque} cm` : 'N/A'}</span></div>
                                <div className="flex justify-between border-b border-gray-700 pb-1"><span>Alc. Bloqueo:</span> <span className="font-bold text-white">{player.alcance_bloqueo ? `${player.alcance_bloqueo} cm` : 'N/A'}</span></div>
                                <div className="flex justify-between pt-1"><span>En equipo desde:</span> <span className="font-bold text-white">{player.fecha_ingreso || 'N/A'}</span></div>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-6">
                        <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700 w-full mb-2">
                            <button onClick={()=>setViewMode('PARTIDO')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center ${viewMode==='PARTIDO'?'bg-red-600 text-white shadow':'text-gray-500 hover:text-gray-300'}`}>
                                <Trophy className="w-3 h-3 mr-1"/> Partidos
                            </button>
                            <button onClick={()=>setViewMode('ENTRENAMIENTO')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center ${viewMode==='ENTRENAMIENTO'?'bg-emerald-600 text-white shadow':'text-gray-500 hover:text-gray-300'}`}>
                                <Dumbbell className="w-3 h-3 mr-1"/> Entrenamientos
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 h-[250px]">
                            <div className="bg-gray-900 rounded-xl border border-gray-700 p-2 relative">
                                <p className="absolute top-2 left-2 text-[10px] text-gray-500 font-bold uppercase">Rendimiento {viewMode === 'PARTIDO' ? 'Competición' : 'Prácticas'}</p>
                                <ResponsiveContainer><RadarChart cx="50%" cy="55%" outerRadius="65%" data={data}><PolarGrid stroke="#374151" /><PolarAngleAxis dataKey="stat" tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 'bold' }} /><PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} /><RechartRadar dataKey="val" stroke={viewMode==='PARTIDO'?"#ef4444":"#10b981"} fill={viewMode==='PARTIDO'?"#ef4444":"#10b981"} fillOpacity={0.5} /><Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', fontSize: '12px' }} itemStyle={{ color: '#fff' }}/></RadarChart></ResponsiveContainer>
                            </div>
                            <div className="bg-gray-900 rounded-xl border border-gray-700 p-2 relative flex flex-col items-center justify-center">
                                <p className="absolute top-2 left-2 text-[10px] text-gray-500 font-bold uppercase">Mapa de Calor (Saque)</p>
                                <div className="relative w-3/4 aspect-square grid grid-cols-3 grid-rows-2 gap-0.5">
                                     {[1,6,5,2,3,4].map(z => <div key={z} className="flex items-center justify-center border border-gray-800/50 font-bold text-xl text-white/10 rounded-sm" style={{backgroundColor: `rgba(${viewMode==='PARTIDO'?'220, 38, 38':'16, 185, 129'}, ${getAlpha(serveZones[z]||0)})`}}>{z}</div>)}
                                     {servePoints.map((pt, i) => <div key={i} className={`absolute w-2 h-2 rounded-full shadow-sm ${pt.res==='ACE'?'bg-emerald-400':(pt.res==='MALO'?'bg-red-500':'bg-blue-400')}`} style={{ left: `${pt.x}%`, top: `${pt.y}%`, transform: 'translate(-50%, -50%)' }} />)}
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-700/30 border border-gray-600 p-4 rounded-xl">
                            <h3 className="font-bold mb-3 text-red-400 text-sm uppercase tracking-widest">Resumen {viewMode === 'PARTIDO' ? 'Global' : 'Entrenamiento'}</h3>
                            <div className="grid grid-cols-4 gap-4 text-center">
                                <div className="bg-gray-800 p-2 rounded-lg border border-gray-700"><p className="text-2xl font-black text-white">{tAtk}</p><p className="text-[10px] text-gray-400 uppercase">Ataques</p></div>
                                <div className="bg-gray-800 p-2 rounded-lg border border-gray-700"><p className="text-2xl font-black text-white">{stats.saques_aces||0}</p><p className="text-[10px] text-gray-400 uppercase">Aces</p></div>
                                <div className="bg-gray-800 p-2 rounded-lg border border-gray-700"><p className="text-2xl font-black text-white">{tBlo}</p><p className="text-[10px] text-gray-400 uppercase">Bloqueos</p></div>
                                <div className="bg-gray-800 p-2 rounded-lg border border-gray-700"><p className="text-2xl font-black text-white">{data.find(d=>d.stat==='Actitud')?.val || 0}%</p><p className="text-[10px] text-gray-400 uppercase">Actitud</p></div>
                            </div>
                            {/* Mostrar Colocación si es relevante */}
                            {['Armador', 'Líbero'].includes(player.posicion) && (
                                <div className="mt-4 pt-4 border-t border-gray-600 grid grid-cols-1 text-center">
                                    <div className="bg-yellow-900/20 p-2 rounded-lg border border-yellow-700">
                                        <p className="text-2xl font-black text-yellow-500">{stats.colocacion_perfecta || 0}</p>
                                        <p className="text-[10px] text-yellow-200 uppercase">Colocaciones Perfectas</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FinalAttitudeModal = ({ db, userId, matchId, players, isOpen, onClose, handleGlobalStatsUpdate, onMatchComplete, showToast }) => {
    const [attitudes, setAttitudes] = useState({});
    useEffect(() => { if(isOpen) setAttitudes(players.reduce((acc,p)=>({...acc, [p.id]:'PERFECTA'}), {})); }, [isOpen, players]);
    const collections = getCollections(userId);

    if (!isOpen) return null;
    const save = async () => {
        const batch = []; const ts = serverTimestamp();
        try {
            for(const p of players) {
                batch.push(addDoc(collection(db, collections.ACTITUD), { partido_id: matchId, jugador_id: p.id, resultado: attitudes[p.id], createdAt: ts }));
                await handleGlobalStatsUpdate(db, userId, p.id, 'ACTITUD', attitudes[p.id]);
            }
            await updateDoc(doc(db, collections.PARTIDOS, matchId), { is_completed: true, completedAt: ts });
            await Promise.all(batch); 
            showToast("Partido finalizado y guardado", "success");
            onClose(); onMatchComplete();
        } catch(e) { console.error("Finalize Error", e); showToast("Error al finalizar", "error"); }
    };
    const OPTS = ['PERFECTA','BUENA','REGULAR','MALA','PÉSIMA'];
    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4"><div className="bg-gray-800 border border-gray-700 text-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6"><h3 className="font-bold text-red-500 mb-6 text-xl">Evaluar Actitud Final</h3>{players.map(p => <div key={p.id} className="mb-3 flex justify-between items-center bg-gray-700/50 p-2 rounded-lg"><span className="font-bold w-1/3 truncate">{p.nombre}</span><div className="flex gap-1 w-2/3">{OPTS.map(o => <button key={o} onClick={()=>setAttitudes(pr=>({...pr,[p.id]:o}))} className={`flex-1 py-1 text-[10px] rounded font-bold transition ${attitudes[p.id]===o?'bg-red-600 text-white shadow-lg':'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}>{o}</button>)}</div></div>)}<button onClick={save} className="w-full bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg font-bold mt-6 text-lg shadow-lg">FINALIZAR PARTIDO</button></div></div>
    );
};

const FinalTrainingAttitudeModal = ({ db, userId, session, players, isOpen, onClose, handleGlobalStatsUpdate, onSessionComplete, showToast }) => {
    const [attitudes, setAttitudes] = useState({});
    const collections = getCollections(userId);

    // Initialización robusta de actitudes
    useEffect(() => { 
        if(isOpen) {
            const initialAttitudes = {};
            const hasAttendanceData = session.attendance && Object.keys(session.attendance).length > 0;
            
            players.forEach(p => {
                // Si hay datos de asistencia, usar 'Presente' para marcar por defecto como PERFECTA, si no, N/A
                // Si NO hay datos de asistencia (sesión antigua o no marcada), marcar todos como PERFECTA para facilitar
                let defaultVal = 'PERFECTA';
                
                if (hasAttendanceData) {
                    const isPresent = session.attendance[p.id] === 'Presente';
                    defaultVal = isPresent ? 'PERFECTA' : 'N/A';
                }
                
                initialAttitudes[p.id] = defaultVal;
            });
            setAttitudes(initialAttitudes);
        } 
    }, [isOpen, players, session]);

    if (!isOpen) return null;

    const save = async () => {
        const batch = []; const ts = serverTimestamp();
        try {
            for(const p of players) {
                const att = attitudes[p.id];
                // Solo guardar si tiene una actitud válida (ignorar N/A)
                if (att && att !== 'N/A') {
                    batch.push(addDoc(collection(db, collections.ACTITUD), { 
                        entrenamiento_id: session.id, 
                        jugador_id: p.id, 
                        resultado: att, 
                        contexto: 'ENTRENAMIENTO', 
                        createdAt: ts 
                    }));
                    await handleGlobalStatsUpdate(db, userId, p.id, 'ACTITUD', att, true);
                }
            }
            await Promise.all(batch); 
            showToast("Entrenamiento finalizado y actitudes guardadas", "success");
            onClose(); onSessionComplete();
        } catch(e) { console.error("Finalize Error", e); showToast("Error al finalizar", "error"); }
    };

    const OPTS = ['PERFECTA','BUENA','REGULAR','MALA','PÉSIMA', 'N/A'];
    
    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 text-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
                <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-emerald-500 text-xl">Evaluar Actitud (Entrenamiento)</h3>
                     <button onClick={onClose}><X className="text-gray-400"/></button>
                </div>
                
                {players.length === 0 && <p className="text-gray-500 text-center py-4">No hay jugadores disponibles para evaluar.</p>}

                {players.map(p => {
                    const isNA = attitudes[p.id] === 'N/A';
                    return (
                        <div key={p.id} className={`mb-3 flex flex-col sm:flex-row justify-between items-center p-2 rounded-lg transition ${isNA ? 'bg-gray-800 border border-gray-700 opacity-60' : 'bg-gray-700/50 border border-transparent'}`}>
                            <span className="font-bold w-full sm:w-1/3 truncate mb-2 sm:mb-0 text-center sm:text-left">{p.nombre}</span>
                            <div className="flex gap-1 w-full sm:w-2/3 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                                {OPTS.map(o => (
                                    <button 
                                        key={o} 
                                        onClick={()=>setAttitudes(pr=>({...pr,[p.id]:o}))} 
                                        className={`flex-1 py-1 px-2 text-[10px] rounded font-bold transition whitespace-nowrap
                                            ${attitudes[p.id]===o 
                                                ? (o==='N/A' ? 'bg-gray-600 text-gray-300' : 'bg-emerald-600 text-white shadow-lg') 
                                                : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`
                                        }
                                    >
                                        {o}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
                <button onClick={save} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg font-bold mt-6 text-lg shadow-lg">
                    FINALIZAR ENTRENAMIENTO
                </button>
            </div>
        </div>
    );
};

// --- 8. INTERFAZ DE JUEGO (TRACKING) ---

const PlayerActionCard = ({ player, posLabel, onClick, isServer, disabled, showRole }) => {
    if (!player) return <div className="h-32 bg-gray-800/30 border border-dashed border-gray-700 rounded-xl flex items-center justify-center text-gray-600 font-bold text-2xl">{posLabel}</div>;
    const style = getRoleColor(player.posicion);
    return (
        <div onClick={() => !disabled && onClick(player)} className={`relative h-32 rounded-xl border-l-4 ${disabled ? 'bg-gray-800 border-gray-700 opacity-40 cursor-not-allowed' : `bg-gray-800 ${style.border} shadow-lg cursor-pointer active:scale-95 hover:bg-gray-700`} p-2 flex flex-col justify-between transition duration-200`}>
            <div className="flex justify-between items-start">
                <span className="text-xs font-bold bg-gray-900 px-1.5 rounded text-gray-400">
                    {showRole ? player.posicion : posLabel}
                </span>
                <span className={`text-lg font-black ${disabled?'text-gray-600':style.text}`}>#{player.numero}</span>
            </div>
            <div className="flex items-center space-x-2"><div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border border-gray-600">{player.fotografia ? <img src={player.fotografia} className="w-full h-full object-cover"/> : <User className="w-6 h-6 m-1.5 text-gray-500"/>}</div><div className="overflow-hidden"><p className="font-bold text-gray-200 truncate text-sm">{player.nombre.split(' ')[0]}</p><p className="text-[10px] text-gray-400 truncate">{player.posicion}</p></div></div>
            {isServer && <div className="absolute -top-2 -right-2 bg-yellow-500 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-yellow-500/20 animate-pulse">SAQUE</div>}
        </div>
    );
};

const ActiveCourt = ({ currentLineup, playersMap, servingTeam, rallyLive, onPlayerClick, onManualRotate, isGameView, matchData }) => {
    const isLocal = servingTeam === 'LOCAL';
    const isPosDisabled = (posKey) => !isGameView && isLocal && !rallyLive && posKey !== 'pos1';

    const liberoId = matchData?.libero_id;
    const libero = liberoId ? playersMap[liberoId] : null;

    const getDisplayPlayer = (posKey) => {
        if (!currentLineup) return null;
        const originalPlayerId = currentLineup[posKey];
        const originalPlayer = playersMap[originalPlayerId];
        
        if (!originalPlayer) return null;

        const isBackRow = ['pos1', 'pos6', 'pos5'].includes(posKey);
        
        if (isBackRow && originalPlayer.posicion === 'Central' && libero) {
            if (posKey === 'pos1') {
                if (servingTeam === 'LOCAL' || (servingTeam === null && !rallyLive)) { 
                    return originalPlayer;
                }
                if (servingTeam === 'RIVAL') {
                    return libero;
                }
                 return libero;
            } else {
                return libero;
            }
        }

        return originalPlayer;
    };

    const getOrderedPlayers = () => {
        if (!currentLineup) return [];

        const p4 = getDisplayPlayer('pos4');
        const p3 = getDisplayPlayer('pos3');
        const p2 = getDisplayPlayer('pos2');
        const p5 = getDisplayPlayer('pos5');
        const p6 = getDisplayPlayer('pos6');
        const p1 = getDisplayPlayer('pos1');

        if (!p4 || !p3 || !p2 || !p5 || !p6 || !p1) return [];

        const frontRow = [p4, p3, p2];
        const backRow = [p5, p6, p1];

        const sortRow = (pool, priorityList) => {
            const sorted = [];
            const tempPool = [...pool];
            priorityList.forEach(roles => {
                const idx = tempPool.findIndex(p => roles.includes(p.posicion));
                if (idx !== -1) {
                    sorted.push(tempPool[idx]);
                    tempPool.splice(idx, 1);
                } else {
                    sorted.push(null);
                }
            });
            return sorted.map(p => p || tempPool.shift());
        };

        const finalFront = sortRow(frontRow, [['Punta'], ['Central'], ['Armador', 'Opuesto']]);
        const finalBack = sortRow(backRow, [['Líbero', 'Central'], ['Punta'], ['Armador', 'Opuesto']]);

        return [...finalFront, ...finalBack];
    };

    const displayPlayers = isGameView 
        ? getOrderedPlayers() 
        : ['pos4','pos3','pos2','pos5','pos6','pos1'].map(k => getDisplayPlayer(k));

    const displayLabels = isGameView
        ? ['Punta', 'Central', 'Op/Arm', 'Lib/Cent', 'Punta', 'Op/Arm']
        : ['P4', 'P3', 'P2', 'P5', 'P6', 'P1'];

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-bold text-red-500 uppercase tracking-widest">
                    {isGameView ? 'Cancha Táctica (Visual)' : 'Cancha Rotación (Real)'}
                </span>
                <button onClick={onManualRotate} className="flex items-center px-3 py-1 bg-gray-800 text-red-400 border border-gray-700 hover:bg-gray-700 text-xs font-bold rounded-lg transition"><RotateCw className="w-3 h-3 mr-1"/> Rotar</button>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 border-2 border-gray-700 flex-grow shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-full w-full pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]"></div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-40 w-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                <div className="absolute top-1 left-1/2 transform -translate-x-1/2 bg-white/10 backdrop-blur text-white/50 text-[10px] px-3 py-0.5 rounded-b font-bold border border-t-0 border-white/10">RED</div>
                
                <div className="absolute top-1/3 left-0 w-full h-0.5 bg-white opacity-20 border-t border-dashed border-gray-400"></div>

                <div className="grid grid-cols-3 gap-3 h-full mt-4 relative z-10">
                    {displayPlayers.map((player, i) => (
                        <PlayerActionCard 
                            key={i} 
                            player={player} 
                            posLabel={displayLabels[i]} 
                            onClick={onPlayerClick} 
                            isServer={!isGameView && i === 5 && isLocal} 
                            disabled={isPosDisabled(isGameView ? null : ['pos4','pos3','pos2','pos5','pos6','pos1'][i])}
                            showRole={isGameView}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

const ServePlacementModal = ({ isOpen, onClose, player, onRegisterServe }) => {
    if (!isOpen || !player) return null;
    const [placement, setPlacement] = useState(null);
    const confirmServe = (result) => { onRegisterServe(player.id, 'SAQUE', result, { x_percent: placement?.x, y_percent: placement?.y, zona: placement?.zone }); onClose(); setPlacement(null); };
    const getZone = (c, r) => r === 0 ? (c === 0 ? 1 : c === 1 ? 6 : 5) : (c === 0 ? 2 : c === 1 ? 3 : 4);
    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
                <div className="p-4 bg-emerald-700 text-white flex justify-between items-center"><h3 className="font-bold flex items-center"><Crosshair className="w-5 h-5 mr-2"/> Saque: {player.nombre}</h3><button onClick={onClose}><X/></button></div>
                <div className="p-6 flex flex-col items-center">
                    {!placement ? (
                        <>
                            <p className="mb-4 text-sm text-gray-400 font-bold uppercase tracking-widest">¿Zona de caída?</p>
                            <div className="relative bg-orange-900/20 border-4 border-orange-500/50 w-64 h-64 grid grid-cols-3 grid-rows-2 cursor-crosshair shadow-[0_0_30px_rgba(249,115,22,0.1)]" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top; const z = getZone(Math.floor(x/(r.width/3)), Math.floor(y/(r.height/2))); setPlacement({x:(x/r.width)*100, y:(y/r.height)*100, zone:z}); }}>
                                {[1,6,5,2,3,4].map(z=><div key={z} className="border border-orange-500/20 flex items-center justify-center text-orange-500/50 font-black text-3xl">{z}</div>)}
                                <div className="absolute top-1/2 left-0 w-full bg-orange-500/50 h-0.5 opacity-50"></div>
                            </div>
                            <button onClick={()=>confirmServe('MALO')} className="mt-6 text-red-500 font-bold text-sm underline hover:text-red-400">Marcar error directo (Red/Fuera)</button>
                        </>
                    ) : (
                        <div className="w-full space-y-3 animate-fade-in-up">
                            <p className="text-center font-bold text-2xl text-white mb-4">Zona {placement.zone}</p>
                            <button onClick={()=>confirmServe('ACE')} className="w-full p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-lg hover:scale-105 transition">ACE DIRECTO</button>
                            <button onClick={()=>confirmServe('BUENO')} className="w-full p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition">CONTINUA JUEGO</button>
                            <button onClick={()=>confirmServe('MALO')} className="w-full p-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition">ERROR</button>
                            <button onClick={()=>setPlacement(null)} className="w-full text-xs text-gray-500 mt-2 hover:text-white">Cancelar selección</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const PlayerActionSheet = ({ isOpen, onClose, player, onRegister, servingTeam, onRequestSubstitution, isTraining }) => {
    const [step, setStep] = useState('CATEGORY');
    const [cat, setCat] = useState(null);
    useEffect(() => { if (isOpen) { setStep('CATEGORY'); setCat(null); } }, [isOpen]);
    if (!isOpen || !player) return null;

    let CATS = [ { id: 'SAQUE', l: 'Saque', i: Volleyball, c: 'bg-emerald-600' }, { id: 'ATAQUE', l: 'Ataque', i: Zap, c: 'bg-orange-600' }, { id: 'BLOQUEO', l: 'Bloqueo', i: Power, c: 'bg-purple-600' }, { id: 'RECEPCION', l: 'Recepción', i: Shield, c: 'bg-blue-600' }, { id: 'DEFENSA', l: 'Defensa', i: Heart, c: 'bg-pink-600' } ];
    
    if (['Armador', 'Líbero'].includes(player.posicion)) {
        CATS.push({ id: 'COLOCACION', l: 'Colocación', i: Hand, c: 'bg-yellow-600' });
    }

    if (!isTraining) {
        if (player.posicion === 'Líbero') CATS = CATS.filter(c => !['ATAQUE', 'BLOQUEO', 'SAQUE'].includes(c.id));
        if (servingTeam === 'LOCAL') CATS = CATS.filter(c => c.id !== 'RECEPCION');
        CATS = CATS.filter(c => c.id !== 'SAQUE'); 
    }

    const RES = {
        'SAQUE': [{id:'ACE',l:'Ace',c:'bg-emerald-600'},{id:'BUENO',l:'Bueno',c:'bg-blue-500'},{id:'MALO',l:'Error',c:'bg-red-600'}],
        'ATAQUE': [{id:'BUENO',l:'Punto',c:'bg-emerald-600'},{id:'DEFENDIDO',l:'Defendido',c:'bg-blue-500'},{id:'BLOQUEADO',l:'Bloqueado',c:'bg-orange-600'},{id:'MALO',l:'Error',c:'bg-red-600'}],
        'BLOQUEO': [{id:'DIRECTO',l:'Punto',c:'bg-purple-600'},{id:'ROZE',l:'Roce',c:'bg-blue-500'},{id:'USADO',l:'Usado',c:'bg-orange-600'},{id:'RED',l:'Red',c:'bg-red-600'}],
        'RECEPCION': [{id:'BUENA',l:'Buena (A)',c:'bg-emerald-600'},{id:'REGULAR',l:'Regular (B)',c:'bg-yellow-600'},{id:'MALA',l:'Mala (C)',c:'bg-red-600'}],
        'DEFENSA': [{id:'BUENA',l:'Perfecta',c:'bg-emerald-600'},{id:'REGULAR',l:'Positiva',c:'bg-yellow-600'},{id:'FALLIDA',l:'Error',c:'bg-red-600'}],
        'COLOCACION': [{id:'PERFECTA',l:'Perfecta',c:'bg-emerald-600'},{id:'BUENA',l:'Buena',c:'bg-blue-500'},{id:'ERROR',l:'Error',c:'bg-red-600'}]
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm pointer-events-auto" onClick={onClose}></div>
            <div className="bg-gray-800 border border-gray-700 w-full max-w-md sm:rounded-xl rounded-t-3xl shadow-2xl pointer-events-auto p-6 pb-10 relative text-gray-100">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X/></button>
                <div className="flex items-center mb-6 border-b border-gray-700 pb-4"><div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden mr-4 border-2 border-red-500">{player.fotografia ? <img src={player.fotografia} className="w-full h-full object-cover"/> : <User className="w-8 h-8 m-3 text-gray-500"/>}</div><div><h3 className="text-xl font-bold">{player.nombre}</h3><p className="text-sm text-red-400 font-bold">#{player.numero} - {player.posicion}</p></div></div>
                {step === 'CATEGORY' ? (
                    <>
                        <div className="grid grid-cols-3 gap-3">
                            {CATS.map(c => <button key={c.id} onClick={()=>{setCat(c.id);setStep('RES')}} className={`${c.c} text-white p-3 rounded-xl shadow-lg border border-white/10 flex flex-col items-center hover:opacity-90 hover:scale-105 transition duration-200`}><c.i className="w-8 h-8 mb-2"/><span className="font-bold text-xs uppercase tracking-wider">{c.l}</span></button>)}
                            {!isTraining && <button onClick={() => { onRequestSubstitution(player); onClose(); }} className="bg-gray-600 text-white p-3 rounded-xl shadow-lg border border-white/10 flex flex-col items-center hover:opacity-90 hover:scale-105 transition duration-200">
                                <ArrowLeftRight className="w-8 h-8 mb-2"/>
                                <span className="font-bold text-xs uppercase tracking-wider">Cambio</span>
                            </button>}
                        </div>
                    </>
                ) : (
                    <div className="space-y-3"><div className="flex items-center mb-4 text-gray-400"><ChevronLeft className="cursor-pointer mr-2 hover:text-white" onClick={()=>setStep('CATEGORY')}/><h4 className="font-bold uppercase tracking-widest text-xs">Registrar {cat}</h4></div><div className="grid grid-cols-1 gap-3">{RES[cat].map(r => <button key={r.id} onClick={()=>{onRegister(player.id,cat,r.id);onClose()}} className={`${r.c} text-white p-4 rounded-xl shadow-lg font-bold flex justify-between px-6 border-b-4 border-black/20 active:border-b-0 active:translate-y-1 transition-all`}><span>{r.l}</span><CheckCircle className="opacity-50"/></button>)}</div></div>
                )}
            </div>
        </div>
    );
};

const SubstitutionModal = ({ isOpen, onClose, playerOut, playersMap, liveRotation, onSubstitute }) => {
    if (!isOpen || !playerOut) return null;

    const playersOnCourtIds = Object.values(liveRotation);
    const benchPlayers = Object.values(playersMap).filter(p => !playersOnCourtIds.includes(p.id) && p.rama === playerOut.rama);

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4 text-gray-100 shadow-2xl">
                <div className="flex justify-between items-center border-b border-gray-700 pb-3">
                    <h3 className="font-bold text-lg text-white flex items-center"><ArrowLeftRight className="mr-2 text-red-500"/> Realizar Cambio</h3>
                    <button onClick={onClose}><X className="text-gray-400 hover:text-white"/></button>
                </div>
                
                <div className="bg-red-900/20 p-3 rounded-lg border border-red-900/50 flex items-center mb-4">
                    <span className="text-xs font-bold text-red-400 mr-2 uppercase">Sale:</span>
                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden mr-2 border border-red-500">
                        {playerOut.fotografia ? <img src={playerOut.fotografia} className="w-full h-full object-cover"/> : <User className="w-5 h-5 m-1.5 text-gray-400"/>}
                    </div>
                    <span className="font-bold text-white text-sm">{playerOut.nombre}</span>
                </div>

                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Selecciona Jugador Entrante (Banca)</p>
                
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {benchPlayers.length > 0 ? benchPlayers.map(p => (
                        <button 
                            key={p.id} 
                            onClick={() => { onSubstitute(playerOut.id, p.id); onClose(); }}
                            className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg flex items-center border border-gray-600 hover:border-emerald-500 transition group text-left"
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden mr-2 border border-gray-500 group-hover:border-emerald-400">
                                {p.fotografia ? <img src={p.fotografia} className="w-full h-full object-cover"/> : <User className="w-5 h-5 m-1.5 text-gray-400"/>}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-xs text-white truncate">{p.nombre}</p>
                                <p className="text-[9px] text-gray-400">{p.posicion}</p>
                            </div>
                        </button>
                    )) : (
                        <p className="col-span-2 text-center text-gray-500 text-xs py-4">No hay suplentes disponibles en la banca.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const MatchTracker = ({ db, userId, match, onGoBack, showToast }) => {
    const [players, setPlayers] = useState([]); 
    const [playersMap, setPlayersMap] = useState({});
    const [liveRotation, setLiveRotation] = useState(match.alineacion_data || {}); 
    const [scores, setScores] = useState({ local: 0, rival: 0 }); 
    const [sets, setSets] = useState({ local: 0, rival: 0 }); 
    const [currentSet, setCurrentSet] = useState(1); 
    const [servingTeam, setServingTeam] = useState(null); 
    const [rallyLive, setRallyLive] = useState(false);
    const [isAttitudeModalOpen, setIsAttitudeModalOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null); 
    const [serverPlayer, setServerPlayer] = useState(null); 
    const [stats, setStats] = useState({ aces: 0, attacks: 0, blocks: 0 });
    const [lastAction, setLastAction] = useState(null);
    const [isGameView, setIsGameView] = useState(false); // New state for Toggle
    
    // Estados para Sustitución
    const [isSubModalOpen, setIsSubModalOpen] = useState(false);
    const [playerToSub, setPlayerToSub] = useState(null);

    useEffect(() => {
        if(db && userId) onSnapshot(query(collection(db, getCollections(userId).JUGADORES)), s => { const l=s.docs.map(d=>({id:d.id,...d.data()})); setPlayers(l); setPlayersMap(l.reduce((a,p)=>({...a,[p.id]:p}),{})); }, e=>console.log(e));
    }, [db, userId]);

    useEffect(() => {
        if(!db || !userId) return;
        const collections = getCollections(userId);
        const u1 = onSnapshot(query(collection(db, collections.SAQUES), where("partido_id","==",match.id), where("resultado","==","ACE")), s=>setStats(p=>({...p,aces:s.size})), e=>console.log(e));
        const u2 = onSnapshot(query(collection(db, collections.ATAQUES), where("partido_id","==",match.id), where("resultado","==","BUENO")), s=>setStats(p=>({...p,attacks:s.size})), e=>console.log(e));
        const u3 = onSnapshot(query(collection(db, collections.BLOQUEOS), where("partido_id","==",match.id), where("resultado","==","DIRECTO")), s=>setStats(p=>({...p,blocks:s.size})), e=>console.log(e));
        return () => { u1(); u2(); u3(); };
    }, [db, userId, match.id]);

    const handlePoint = (winner) => {
        setRallyLive(false); 
        let server = servingTeam || winner;
        if (!servingTeam) setServingTeam(winner);
        if (winner === 'LOCAL' && server === 'RIVAL') { setLiveRotation(rotateLineupClockwise(liveRotation)); setServingTeam('LOCAL'); }
        else if (winner === 'RIVAL' && server === 'LOCAL') setServingTeam('RIVAL');
        setScores(prev => {
            const next = { ...prev, [winner.toLowerCase()]: prev[winner.toLowerCase()] + 1 };
            if((next.local>=25 && next.local-next.rival>=2) || (next.rival>=25 && next.rival-next.local>=2)) {
                showToast(`Set terminado! Ganó ${winner}`, 'success');
                setSets(s => ({ ...s, [winner.toLowerCase()]: s[winner.toLowerCase()] + 1 }));
                setCurrentSet(c => c + 1); setServingTeam(null); return { local: 0, rival: 0 };
            }
            return next;
        });
    };

    const adjustScore = (team, delta) => {
        setScores(prev => {
            const val = prev[team.toLowerCase()] + delta;
            return { ...prev, [team.toLowerCase()]: Math.max(0, val) };
        });
    };

    const onPlayerAction = async (pid, cat, res, extra = {}) => {
        const pName = playersMap[pid]?.nombre?.split(' ')[0] || 'Jugador';
        setLastAction(`${pName} - ${cat}: ${res}`);
        showToast(`${pName} - ${cat} Registrado`, res.includes('BUEN') || res === 'ACE' || res === 'DIRECTO' ? 'success' : 'info');
        
        await handleRegisterEvent(db, userId, match.id, pid, cat, res, extra);
        if (cat === 'SAQUE') {
            if (res === 'ACE') handlePoint('LOCAL'); 
            else if (res === 'MALO') handlePoint('RIVAL'); 
            else if (res === 'BUENO') setRallyLive(true); 
        } else {
            if(['DIRECTO'].includes(res) || (cat==='ATAQUE' && res==='BUENO')) handlePoint('LOCAL');
            else if(['MALO','RED','MALA','FALLIDA','USADO'].includes(res)) handlePoint('RIVAL');
        }
    };

    const handleCardClick = (player) => {
        if (servingTeam === 'LOCAL' && !rallyLive && player.id === liveRotation.pos1) {
            if (player.posicion === 'Líbero') return showToast("El líbero no puede sacar.", "error");
            setServerPlayer(player);
        } else {
            setSelectedPlayer(player);
        }
    };

    const handleRequestSubstitution = (player) => {
        setPlayerToSub(player);
        setIsSubModalOpen(true);
    };

    const performSubstitution = (outId, inId) => {
        const newRotation = { ...liveRotation };
        let posKey = null;
        for (const [key, val] of Object.entries(newRotation)) {
            if (val === outId) {
                posKey = key;
                break;
            }
        }

        if (posKey) {
            newRotation[posKey] = inId;
            setLiveRotation(newRotation);
            const inPlayerName = playersMap[inId]?.nombre?.split(' ')[0];
            const outPlayerName = playersMap[outId]?.nombre?.split(' ')[0];
            showToast(`Cambio: Entra ${inPlayerName}, Sale ${outPlayerName}`, 'info');
        }
    };

    return (
        <div className="pb-24 space-y-4">
            <div className="bg-gray-800 rounded-xl shadow-lg border-t-4 border-red-600 overflow-hidden">
                <div className="p-3 bg-gray-900 border-b border-gray-700 flex justify-between items-center"><button onClick={onGoBack} className="text-red-500 font-bold flex items-center hover:text-red-400"><ChevronLeft className="w-4 h-4"/> Salir</button><span className="text-xs font-bold text-red-600 animate-pulse">EN VIVO</span></div>
                <div className="p-4 flex justify-between items-center bg-gray-800">
                    <div className="flex flex-col items-center w-1/3">
                        <h2 className="text-sm font-black text-red-500 tracking-widest">REYES</h2>
                        <div className="text-5xl font-black text-white relative">{scores.local}{servingTeam==='LOCAL'&&<Volleyball className="absolute -top-3 -right-5 w-6 h-6 text-yellow-500 animate-bounce"/>}</div>
                        <div className="flex gap-2 mt-2"><button onClick={()=>adjustScore('LOCAL', -1)} className="bg-gray-700 text-white p-1 rounded hover:bg-gray-600"><Minus size={12}/></button><button onClick={()=>adjustScore('LOCAL', 1)} className="bg-red-900/50 text-red-200 border border-red-800 p-1 rounded hover:bg-red-800"><Plus size={12}/></button></div>
                    </div>
                    <div className="flex flex-col items-center w-1/3 space-y-2"><div className="bg-gray-700 border border-gray-600 px-3 py-1 rounded-full text-xs font-bold text-gray-300">SET {currentSet}</div><div className="text-2xl font-bold text-gray-500">VS</div><div className="text-xs text-gray-400 font-bold tracking-widest">{sets.local} - {sets.rival}</div></div>
                    <div className="flex flex-col items-center w-1/3">
                        <h2 className="text-sm font-black text-gray-400 truncate w-full text-center tracking-widest">{match.equipo_rival}</h2>
                        <div className="text-5xl font-black text-white relative">{scores.rival}{servingTeam==='RIVAL'&&<Volleyball className="absolute -top-3 -right-5 w-6 h-6 text-yellow-500 animate-bounce"/>}</div>
                        <div className="flex gap-2 mt-2"><button onClick={()=>adjustScore('RIVAL', -1)} className="bg-gray-700 text-white p-1 rounded hover:bg-gray-600"><Minus size={12}/></button><button onClick={()=>adjustScore('RIVAL', 1)} className="bg-gray-700 text-white p-1 rounded hover:bg-gray-600"><Plus size={12}/></button></div>
                    </div>
                </div>
                {lastAction && <div className="bg-gray-900 text-gray-400 text-xs text-center py-1 flex items-center justify-center"><History className="w-3 h-3 mr-1"/> Última: <span className="text-white ml-1 font-bold">{lastAction}</span></div>}
                
                {/* Toggle Controls for Court View */}
                <div className="flex justify-center bg-gray-800 pb-2">
                    <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
                        <button onClick={()=>setIsGameView(false)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition flex items-center ${!isGameView?'bg-gray-700 text-white shadow':'text-gray-500 hover:text-gray-300'}`}>
                            <RefreshCw className="w-3 h-3 mr-1"/> Rotación
                        </button>
                        <button onClick={()=>setIsGameView(true)} className={`px-4 py-1.5 text-xs font-bold rounded-md transition flex items-center ${isGameView?'bg-red-600 text-white shadow':'text-gray-500 hover:text-gray-300'}`}>
                            <Layout className="w-3 h-3 mr-1"/> Juego
                        </button>
                    </div>
                </div>

                {!servingTeam && <div className="flex justify-center pb-4 gap-2 bg-gray-800"><button onClick={()=>setServingTeam('LOCAL')} className="bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-red-900/50 hover:bg-red-500 transition">Saca Reyes</button><button onClick={()=>setServingTeam('RIVAL')} className="bg-gray-600 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-gray-500 transition">Saca Rival</button></div>}
            </div>
            
            <ActiveCourt 
                currentLineup={liveRotation} 
                playersMap={playersMap} 
                servingTeam={servingTeam} 
                rallyLive={rallyLive} 
                onPlayerClick={handleCardClick} 
                onManualRotate={()=>setLiveRotation(rotateLineupClockwise(liveRotation))} 
                isGameView={isGameView}
                matchData={match}
            />
            
            <PlayerActionSheet 
                isOpen={!!selectedPlayer} 
                onClose={()=>setSelectedPlayer(null)} 
                player={selectedPlayer} 
                onRegister={onPlayerAction} 
                servingTeam={servingTeam}
                onRequestSubstitution={handleRequestSubstitution} 
            />
            
            <ServePlacementModal isOpen={!!serverPlayer} onClose={()=>setServerPlayer(null)} player={serverPlayer} onRegisterServe={(pid, cat, res, extra) => onPlayerAction(pid, cat, res, extra)} />
            
            <SubstitutionModal 
                isOpen={isSubModalOpen} 
                onClose={()=>setIsSubModalOpen(false)} 
                playerOut={playerToSub} 
                playersMap={playersMap} 
                liveRotation={liveRotation}
                onSubstitute={performSubstitution}
            />

            <div className="grid grid-cols-3 gap-2"><StatCard icon={Volleyball} title="Aces" value={stats.aces} color="bg-emerald-600"/><StatCard icon={Zap} title="Ataques" value={stats.attacks} color="bg-orange-600"/><StatCard icon={Power} title="Bloqueos" value={stats.blocks} color="bg-purple-600"/></div>
            <div className="fixed bottom-20 right-6 z-40"><button onClick={()=>setIsAttitudeModalOpen(true)} className="bg-red-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition font-bold flex items-center border-2 border-red-400"><Trophy className="w-5 h-5 mr-2"/> Fin</button></div>
            <FinalAttitudeModal db={db} userId={userId} matchId={match.id} players={players} isOpen={isAttitudeModalOpen} onClose={()=>setIsAttitudeModalOpen(false)} handleGlobalStatsUpdate={handleGlobalStatsUpdate} onMatchComplete={onGoBack} showToast={showToast} />
        </div>
    );
};

// --- NUEVO COMPONENTE: TRAINING TRACKER ---
const TrainingTracker = ({ db, userId, session, onGoBack, showToast }) => {
    const [players, setPlayers] = useState([]); 
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [lastAction, setLastAction] = useState(null);
    const [filterPos, setFilterPos] = useState('TODOS');
    const [search, setSearch] = useState('');
    const [isAttitudeModalOpen, setIsAttitudeModalOpen] = useState(false);

    const collections = getCollections(userId);

    // Cargar jugadores
    useEffect(() => {
        if(db && userId && session) {
            const q = query(collection(db, collections.JUGADORES));
            const unsub = onSnapshot(q, s => {
                const allPlayers = s.docs.map(d=>({id:d.id,...d.data()}));
                setPlayers(allPlayers);
            });
            return () => unsub();
        }
    }, [db, userId, session]);

    const onPlayerAction = async (pid, cat, res) => {
        const p = players.find(p=>p.id===pid);
        const pName = p?.nombre?.split(' ')[0] || 'Jugador';
        setLastAction(`${pName} - ${cat}: ${res}`);
        showToast(`${pName} - ${cat} Registrado (Entrenamiento)`, 'success');
        
        // Registrar evento con contexto ENTRENAMIENTO
        await handleRegisterEvent(db, userId, session.id, pid, cat, res, {}, true);
    };

    const filteredPlayers = players.filter(p => {
        const matchesPos = filterPos === 'TODOS' || p.posicion === filterPos;
        const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.numero.includes(search);
        // Filtrar por rama también para no mezclar si la sesión es de una rama
        const matchesRama = session.rama ? p.rama === session.rama : true;
        return matchesPos && matchesSearch && matchesRama;
    });

    return (
        <div className="pb-24 space-y-4">
            <div className="bg-gray-800 rounded-xl shadow-lg border-t-4 border-emerald-600 overflow-hidden sticky top-0 z-20">
                <div className="p-3 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
                    <button onClick={onGoBack} className="text-emerald-500 font-bold flex items-center hover:text-emerald-400"><ChevronLeft className="w-4 h-4"/> Salir</button>
                    <span className="text-xs font-bold text-emerald-600 animate-pulse uppercase">Modo Entrenamiento</span>
                </div>
                <div className="p-4 flex flex-col items-center bg-gray-800">
                     <h2 className="text-xl font-black text-white">{session.date}</h2>
                     <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{session.rama} - {players.length} Jugadores</p>
                </div>
                
                {/* Buscador y Filtros en Tracker */}
                <div className="px-4 pb-4 space-y-2 bg-gray-800">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"/>
                        <input className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 pl-10 pr-4 text-xs text-white placeholder-gray-500 focus:border-emerald-500 transition" placeholder="Buscar jugador..." value={search} onChange={e=>setSearch(e.target.value)} />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['TODOS','Punta','Central','Líbero','Armador','Opuesto'].map(f=><button key={f} onClick={()=>setFilterPos(f)} className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition ${filterPos===f?'bg-emerald-600 text-white':'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{f}</button>)}
                    </div>
                </div>

                {lastAction && <div className="bg-gray-900 text-gray-400 text-xs text-center py-1 flex items-center justify-center"><History className="w-3 h-3 mr-1"/> Última: <span className="text-white ml-1 font-bold">{lastAction}</span></div>}
            </div>

            <div className="grid grid-cols-3 gap-3">
                {filteredPlayers.map(p => {
                    const style = getRoleColor(p.posicion);
                    const isPresent = session.attendance && session.attendance[p.id] === 'Presente';
                    return (
                        <div key={p.id} onClick={() => setSelectedPlayer(p)} className={`rounded-xl border ${style.border} ${style.bg} p-2 flex flex-col items-center cursor-pointer active:scale-95 transition shadow-lg relative`}>
                             {!isPresent && <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" title="No marcado como presente"></div>}
                             <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden border-2 border-gray-500 mb-2">
                                {p.fotografia ? <img src={p.fotografia} className="w-full h-full object-cover"/> : <User className="w-8 h-8 m-4 text-gray-500"/>}
                            </div>
                            <p className="font-bold text-gray-200 text-xs text-center truncate w-full">{p.nombre.split(' ')[0]}</p>
                            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded text-gray-300 mt-1">{p.posicion}</span>
                        </div>
                    );
                })}
            </div>

            {filteredPlayers.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    <p>No se encontraron jugadores.</p>
                </div>
            )}

            <div className="fixed bottom-20 right-6 z-40">
                <button onClick={()=>setIsAttitudeModalOpen(true)} className="bg-emerald-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition font-bold flex items-center border-2 border-emerald-400">
                    <Medal className="w-5 h-5 mr-2"/> Finalizar y Evaluar
                </button>
            </div>

            <PlayerActionSheet 
                isOpen={!!selectedPlayer} 
                onClose={()=>setSelectedPlayer(null)} 
                player={selectedPlayer} 
                onRegister={onPlayerAction} 
                servingTeam={null} 
                isTraining={true} 
            />

            <FinalTrainingAttitudeModal 
                db={db} 
                userId={userId} 
                session={session} 
                // CORRECCIÓN: Filtrar por rama en lugar de por asistencia estricta para evitar listas vacías
                players={players.filter(p => session.rama ? p.rama === session.rama : true)}
                isOpen={isAttitudeModalOpen} 
                onClose={()=>setIsAttitudeModalOpen(false)} 
                handleGlobalStatsUpdate={handleGlobalStatsUpdate} 
                onSessionComplete={onGoBack} 
                showToast={showToast} 
            />
        </div>
    );
};

const AttendanceManager = ({ db, userId, showToast, onOpenTracker }) => {
    const [sessions, setSessions] = useState([]);
    const [players, setPlayers] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRama, setSelectedRama] = useState('Varonil');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isCancelled, setIsCancelled] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [attendanceData, setAttendanceData] = useState({});
    const collections = getCollections(userId);

    useEffect(() => {
        if (!db || !userId) return;
        const q = query(collection(db, collections.ENTRENAMIENTOS));
        const unsub = onSnapshot(q, s => {
            setSessions(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.date) - new Date(a.date)));
        });
        
        // Fetch players for attendance list
        const qPlayers = query(collection(db, collections.JUGADORES));
        const unsubPlayers = onSnapshot(qPlayers, s => {
            setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsub(); unsubPlayers(); };
    }, [db, userId]);

    const handleOpenModal = () => {
        setIsModalOpen(true);
        setAttendanceData({});
        setIsCancelled(false);
        setCancelReason('');
        setSelectedDate(new Date().toISOString().split('T')[0]);
    };

    const handleSave = async () => {
        if (!selectedDate) return showToast('Selecciona una fecha', 'error');
        if (isCancelled && !cancelReason) return showToast('Indica el motivo de cancelación', 'error');

        const sessionData = {
            date: selectedDate,
            rama: selectedRama,
            status: isCancelled ? 'Cancelled' : 'Completed',
            cancelReason: isCancelled ? cancelReason : null,
            attendance: isCancelled ? {} : attendanceData,
            createdAt: serverTimestamp(),
            createdBy: userId
        };

        try {
            await addDoc(collection(db, collections.ENTRENAMIENTOS), sessionData);
            showToast('Asistencia guardada correctamente', 'success');
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            showToast('Error al guardar asistencia', 'error');
        }
    };

    const filteredPlayers = players.filter(p => p.rama === selectedRama);

    const toggleAttendance = (playerId, isChecked) => {
        setAttendanceData(prev => ({
            ...prev,
            [playerId]: isChecked ? 'Presente' : 'Ausente'
        }));
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'Presente': return 'bg-emerald-900/40 border-emerald-500/50 text-emerald-200';
            default: return 'bg-gray-800 border-gray-600 text-gray-400';
        }
    };

    return (
        <div className="space-y-4 pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-white tracking-tight">Asistencia</h2>
                <button onClick={handleOpenModal} className="bg-red-600 text-white px-4 py-2 rounded-full shadow-lg shadow-red-900/50 flex items-center font-bold hover:bg-red-500 transition">
                    <Plus className="w-4 h-4 mr-1"/> Nueva Sesión
                </button>
            </div>

            <div className="space-y-3">
                {sessions.map(session => (
                    <div key={session.id} className="bg-gray-800 rounded-xl p-4 border-l-4 border-gray-600 shadow-md">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-white flex items-center"><CalendarDays className="w-4 h-4 mr-1 text-gray-400"/> {session.date}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${session.rama === 'Varonil' ? 'bg-blue-900/30 text-blue-300 border-blue-800' : 'bg-pink-900/30 text-pink-300 border-pink-800'}`}>{session.rama}</span>
                                </div>
                                {session.status === 'Cancelled' ? (
                                    <p className="text-red-400 text-xs font-bold flex items-center"><CloudRain className="w-3 h-3 mr-1"/> Cancelado: {session.cancelReason}</p>
                                ) : (
                                    <p className="text-emerald-400 text-xs font-bold flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Completado ({Object.keys(session.attendance || {}).filter(k => session.attendance[k] === 'Presente').length} presentes)</p>
                                )}
                            </div>
                            {/* BOTÓN PARA IR A ESTADÍSTICAS DE ENTRENAMIENTO */}
                            {session.status !== 'Cancelled' && (
                                <button 
                                    onClick={() => onOpenTracker(session)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg font-bold shadow-lg flex items-center text-xs"
                                >
                                    <Activity className="w-4 h-4 mr-1"/> Stats
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {sessions.length === 0 && <div className="text-center py-10 text-gray-500"><p>No hay registros de asistencia.</p></div>}
            </div>

            {/* Modal de Registro de Asistencia */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-gray-100 flex flex-col">
                        <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center sticky top-0 z-10">
                            <h3 className="font-bold text-lg text-white flex items-center"><ClipboardList className="mr-2 text-red-500"/> Registrar Entrenamiento</h3>
                            <button onClick={()=>setIsModalOpen(false)}><X/></button>
                        </div>
                        
                        <div className="p-4 space-y-4 flex-grow overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Fecha</label>
                                    <input type="date" className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Rama</label>
                                    <select className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white" value={selectedRama} onChange={e=>setSelectedRama(e.target.value)}>
                                        <option value="Varonil">Varonil</option>
                                        <option value="Femenil">Femenil</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-gray-700/30 p-3 rounded-lg border border-gray-600">
                                <label className="flex items-center cursor-pointer mb-2">
                                    <input type="checkbox" className="w-4 h-4 text-red-600 rounded focus:ring-red-500 bg-gray-700 border-gray-500" checked={isCancelled} onChange={e=>setIsCancelled(e.target.checked)}/>
                                    <span className="ml-2 text-sm font-bold text-red-400">Marcar como Cancelado</span>
                                </label>
                                {isCancelled && (
                                    <input className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white placeholder-gray-500 mt-2" placeholder="Motivo (ej: Lluvia, Festivo)" value={cancelReason} onChange={e=>setCancelReason(e.target.value)}/>
                                )}
                            </div>

                            {!isCancelled && (
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lista de Jugadores ({filteredPlayers.length})</h4>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                        {filteredPlayers.map(p => {
                                            const isPresent = attendanceData[p.id] === 'Presente';
                                            return (
                                                <div key={p.id} className={`p-3 rounded-lg border flex justify-between items-center transition select-none ${getStatusColor(isPresent ? 'Presente' : 'Ausente')}`}>
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-600 overflow-hidden mr-3">
                                                            {p.fotografia ? <img src={p.fotografia} className="w-full h-full object-cover"/> : <User className="w-5 h-5 m-1.5 text-gray-500"/>}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-sm text-gray-200">{p.nombre}</p>
                                                            <p className="text-[9px] text-gray-500">{p.posicion}</p>
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center space-x-2 cursor-pointer">
                                                        <span className={`text-[10px] font-bold uppercase ${isPresent ? 'text-emerald-400' : 'text-gray-500'}`}>{isPresent ? 'Presente' : 'Ausente'}</span>
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-5 h-5 rounded border-gray-500 text-emerald-600 focus:ring-emerald-500 bg-gray-800"
                                                            checked={isPresent}
                                                            onChange={(e) => toggleAttendance(p.id, e.target.checked)}
                                                        />
                                                    </label>
                                                </div>
                                            )
                                        })}
                                        {filteredPlayers.length === 0 && <p className="text-center text-gray-500 text-xs py-4">No hay jugadores registrados en esta rama.</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-b-xl">
                            <button onClick={handleSave} className="w-full bg-red-600 hover:bg-red-500 text-white p-3 rounded-lg font-bold shadow-lg transition">GUARDAR ASISTENCIA</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PaymentsManager = ({ db, userId, showToast }) => {
    const [players, setPlayers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedRama, setSelectedRama] = useState('Varonil');
    const collections = getCollections(userId);

    useEffect(() => {
        if (!db || !userId) return;
        const qPlayers = query(collection(db, collections.JUGADORES));
        const unsubPlayers = onSnapshot(qPlayers, s => setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => unsubPlayers();
    }, [db, userId]);

    useEffect(() => {
        if (!db || !userId) return;
        const qPayments = query(collection(db, collections.PAGOS)); 
        const unsubPayments = onSnapshot(qPayments, s => {
            setPayments(s.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubPayments();
    }, [db, userId]);

    const filteredPlayers = players.filter(p => p.rama === selectedRama);
    
    const paymentsMap = useMemo(() => {
        const map = {};
        payments.forEach(p => {
            if (p.monthStr === selectedMonth) {
                map[p.playerId] = p;
            }
        });
        return map;
    }, [payments, selectedMonth]);

    const togglePayment = async (player) => {
        const existingPayment = paymentsMap[player.id];
        try {
            if (existingPayment) {
                await deleteDoc(doc(db, collections.PAGOS, existingPayment.id));
                showToast(`Pago de ${player.nombre.split(' ')[0]} eliminado`, 'info');
            } else {
                const docId = `${selectedMonth}_${player.id}`;
                await setDoc(doc(db, collections.PAGOS, docId), {
                    playerId: player.id,
                    monthStr: selectedMonth,
                    paidAt: serverTimestamp(),
                    createdBy: userId
                });
                showToast(`Pago de ${player.nombre.split(' ')[0]} registrado`, 'success');
            }
        } catch (e) {
            console.error("Error toggling payment", e);
            showToast("Error al actualizar pago", "error");
        }
    };

    const paidCount = Object.keys(paymentsMap).filter(pid => filteredPlayers.find(p => p.id === pid)).length;

    return (
        <div className="space-y-4 pb-20">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-white tracking-tight">Pagos</h2>
                <div className="bg-gray-800 px-3 py-1 rounded-lg border border-gray-700 text-sm font-bold text-emerald-400">
                    {paidCount} / {filteredPlayers.length} Pagados
                </div>
            </div>

            {/* Controles de Filtro */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-4 shadow-lg">
                <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 mb-1 block">Mes de Pago</label>
                    <input 
                        type="month" 
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg p-2 text-white font-bold"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                    />
                </div>
                
                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-600">
                    <button onClick={()=>setSelectedRama('Varonil')} className={`flex-1 py-1 text-xs font-bold rounded transition ${selectedRama==='Varonil'?'bg-blue-900/50 text-blue-200 border border-blue-800':'text-gray-500 hover:text-gray-300'}`}>Varonil</button>
                    <button onClick={()=>setSelectedRama('Femenil')} className={`flex-1 py-1 text-xs font-bold rounded transition ${selectedRama==='Femenil'?'bg-pink-900/50 text-pink-200 border border-pink-800':'text-gray-500 hover:text-gray-300'}`}>Femenil</button>
                </div>
            </div>

            {/* Lista de Jugadores */}
            <div className="grid grid-cols-1 gap-2">
                {filteredPlayers.length > 0 ? filteredPlayers.map(p => {
                    const isPaid = !!paymentsMap[p.id];
                    return (
                        <div 
                            key={p.id} 
                            onClick={() => togglePayment(p)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center group ${isPaid ? 'bg-emerald-900/20 border-emerald-600/50 hover:bg-emerald-900/30' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}
                        >
                            <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-full overflow-hidden border-2 mr-3 ${isPaid ? 'border-emerald-500' : 'border-gray-600'}`}>
                                    {p.fotografia ? <img src={p.fotografia} className="w-full h-full object-cover"/> : <User className="w-6 h-6 m-1.5 text-gray-500"/>}
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${isPaid ? 'text-white' : 'text-gray-300'}`}>{p.nombre}</p>
                                    <p className="text-[10px] text-gray-500">#{p.numero} - {p.posicion}</p>
                                </div>
                            </div>
                            
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isPaid ? 'bg-emerald-600 border-emerald-500 text-white scale-110 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-transparent border-gray-600 text-transparent group-hover:border-gray-400'}`}>
                                <Check size={16} strokeWidth={4} />
                            </div>
                        </div>
                    );
                }) : (
                    <div className="text-center py-8 text-gray-500">No hay jugadores en esta rama.</div>
                )}
            </div>
        </div>
    );
};

// --- 9. VISTAS DE GESTIÓN ---
const PlayerList = ({ db, userId, showToast }) => {
    const [players, setPlayers] = useState([]);
    const [globalStats, setGlobalStats] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statsModal, setStatsModal] = useState({ open: false, player: null });
    const [editingPlayer, setEditingPlayer] = useState(null); // Estado para el jugador a editar
    const [filterPos, setFilterPos] = useState('TODOS');
    const [filterRama, setFilterRama] = useState('TODOS'); // Filter for Gender/Branch
    const [search, setSearch] = useState('');
    const collections = getCollections(userId);

    useEffect(() => { 
        if(!db || !userId) return;
        const u1 = onSnapshot(query(collection(db, collections.JUGADORES)), s => setPlayers(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.numero-b.numero)), e=>console.log(e)); 
        const u2 = onSnapshot(query(collection(db, collections.ESTADISTICAS_GLOBALES)), s => { const m={}; s.docs.forEach(d=>m[d.id]=d.data()); setGlobalStats(m); }, e=>console.log(e));
        return () => { u1(); u2(); };
    }, [db, userId]);

    const filteredPlayers = players.filter(p => {
        const matchesPos = filterPos === 'TODOS' || p.posicion === filterPos;
        const matchesRama = filterRama === 'TODOS' || p.rama === filterRama; // Match Gender
        const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.numero.includes(search);
        return matchesPos && matchesRama && matchesSearch;
    });

    const handleEditClick = (e, player) => {
        e.stopPropagation(); 
        setEditingPlayer(player);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPlayer(null); // Resetear al cerrar
    };

    return (
        <div className="space-y-4 pb-20">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-black text-white tracking-tight">Plantilla</h2><button onClick={()=>setIsModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded-full shadow-lg shadow-red-900/50 flex items-center font-bold hover:bg-red-500 transition"><Plus className="w-4 h-4 mr-1"/> Nuevo</button></div>
            
            {/* Buscador y Filtros */}
            <div className="bg-gray-800 p-3 rounded-xl shadow-lg border border-gray-700 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"/>
                    <input className="w-full bg-gray-900 border border-gray-600 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-red-500 focus:border-red-500 transition" placeholder="Buscar por nombre o número..." value={search} onChange={e=>setSearch(e.target.value)} />
                </div>
                
                {/* Rama (Gender) Filter */}
                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-600">
                    <button onClick={()=>setFilterRama('TODOS')} className={`flex-1 py-1 text-xs font-bold rounded transition ${filterRama==='TODOS'?'bg-gray-700 text-white shadow':'text-gray-500 hover:text-gray-300'}`}>Todos</button>
                    <button onClick={()=>setFilterRama('Varonil')} className={`flex-1 py-1 text-xs font-bold rounded transition ${filterRama==='Varonil'?'bg-blue-900/50 text-blue-200 border border-blue-800':'text-gray-500 hover:text-gray-300'}`}>Varonil</button>
                    <button onClick={()=>setFilterRama('Femenil')} className={`flex-1 py-1 text-xs font-bold rounded transition ${filterRama==='Femenil'?'bg-pink-900/50 text-pink-200 border border-pink-800':'text-gray-500 hover:text-gray-300'}`}>Femenil</button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {['TODOS','Punta','Central','Líbero','Armador','Opuesto'].map(f=><button key={f} onClick={()=>setFilterPos(f)} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${filterPos===f?'bg-red-600 text-white':'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{f}</button>)}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredPlayers.length > 0 ? filteredPlayers.map(p => (
                    <div key={p.id} onClick={()=>setStatsModal({open:true, player:p})} className="bg-gray-800 p-3 rounded-xl shadow-md flex items-center space-x-3 border border-gray-700 cursor-pointer hover:bg-gray-750 hover:border-red-500/50 transition duration-200 group relative">
                        <div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden border-2 border-gray-600 group-hover:border-red-500 transition">{p.fotografia?<img src={p.fotografia} className="w-full h-full object-cover"/>:<User className="w-6 h-6 m-3 text-gray-500"/>}</div>
                        <div className="flex-grow">
                            <div className="flex justify-between items-center"><h3 className="font-bold text-gray-200 text-lg">{p.nombre}</h3><span className="font-black text-red-500 text-xl opacity-80 group-hover:opacity-100">#{p.numero}</span></div>
                            <div className="flex gap-2 mt-1">
                                <span className="text-xs bg-gray-900 text-gray-400 px-2 py-0.5 rounded border border-gray-700 font-medium uppercase tracking-wide">{p.posicion}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${p.rama === 'Varonil' ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 'bg-pink-900/30 border-pink-800 text-pink-300'}`}>{p.rama?.[0] || 'V'}</span>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => handleEditClick(e, p)}
                            className="absolute top-2 right-2 p-1.5 bg-gray-700 text-gray-400 rounded-full hover:bg-red-600 hover:text-white transition shadow-sm border border-gray-600 hover:border-red-500 opacity-0 group-hover:opacity-100"
                        >
                            <Pencil size={14} />
                        </button>
                    </div>
                )) : <p className="text-gray-500 text-center py-8">No se encontraron jugadores.</p>}
            </div>
            <AddPlayerModal db={db} userId={userId} isOpen={isModalOpen} onClose={handleCloseModal} showToast={showToast} playerToEdit={editingPlayer} />
            <PlayerStatsModal isOpen={statsModal.open} onClose={()=>setStatsModal({open:false, player:null})} player={statsModal.player} stats={statsModal.player ? (globalStats[statsModal.player.id] || {}) : {}} db={db} userId={userId} />
        </div>
    );
};

const MatchesList = ({ db, userId, onStartTracking, showToast }) => {
    const [matches, setMatches] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('PENDING'); // PENDING, COMPLETED
    const collections = getCollections(userId);

    useEffect(() => { if(db && userId) onSnapshot(query(collection(db, collections.PARTIDOS)), s => setMatches(s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.fecha)-new Date(a.fecha))), e=>console.log(e)); }, [db, userId]);

    const filteredMatches = matches.filter(m => filterStatus === 'COMPLETED' ? m.is_completed : !m.is_completed);

    return (
        <div className="space-y-4 pb-20">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-black text-white tracking-tight">Partidos</h2><button onClick={()=>setIsModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded-full shadow-lg shadow-red-900/50 flex items-center font-bold hover:bg-red-500 transition"><Plus className="w-4 h-4 mr-1"/> Crear</button></div>
            
            <div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">
                <button onClick={()=>setFilterStatus('PENDING')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${filterStatus==='PENDING'?'bg-gray-700 text-white shadow':'text-gray-500 hover:text-gray-300'}`}>Pendientes</button>
                <button onClick={()=>setFilterStatus('COMPLETED')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${filterStatus==='COMPLETED'?'bg-gray-700 text-white shadow':'text-gray-500 hover:text-gray-300'}`}>Finalizados</button>
            </div>

            <div className="space-y-3">
                {filteredMatches.length > 0 ? filteredMatches.map(m => (
                    <div key={m.id} className="bg-gray-800 rounded-xl p-5 shadow-lg border-l-4 border-red-600 flex flex-col gap-2 hover:bg-gray-750 transition">
                        <div className="flex justify-between items-start">
                            <div><span className="text-xs font-bold text-red-500 uppercase tracking-widest">VS</span><h3 className="text-xl font-black text-white">{m.equipo_rival}</h3></div>
                            {m.is_completed ? 
                                <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-900 text-xs px-3 py-1 rounded-full font-bold flex items-center"><Check className="w-3 h-3 mr-1"/> Finalizado</span> : 
                                <button onClick={()=>onStartTracking(m.id, m)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-red-900/40 tracking-wider flex items-center"><Activity className="w-3 h-3 mr-2"/> TRACKING</button>
                            }
                        </div>
                        <div className="flex items-center text-xs text-gray-400 font-medium border-t border-gray-700 pt-2 mt-1"><Calendar className="w-3 h-3 mr-1 text-red-500"/> {m.fecha} <span className="mx-2 text-gray-600">•</span> <MapIcon className="w-3 h-3 mr-1 text-red-500"/> {m.lugar}</div>
                    </div>
                )) : <div className="text-center py-10 text-gray-500 flex flex-col items-center"><Calendar className="w-10 h-10 mb-2 opacity-20"/><p>No hay partidos en esta categoría</p></div>}
            </div>
            <AddMatchModal db={db} userId={userId} isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} showToast={showToast} />
        </div>
    );
};

// --- 10. CONFIGURACIÓN ---
const LineupManager = ({ db, userId, showToast }) => {
    const POS = [{id:'pos4',l:'4', t:'Punta'},{id:'pos3',l:'3', t:'Central'},{id:'pos2',l:'2', t:'Arm/Op'},{id:'pos5',l:'5', t:'Defensa'},{id:'pos6',l:'6', t:'Defensa'},{id:'pos1',l:'1', t:'Saque'}];
    const [players, setPlayers] = useState([]);
    const [lineup, setLineup] = useState({});
    const [name, setName] = useState('');
    const [filter, setFilter] = useState('TODOS');
    const [filterRama, setFilterRama] = useState('Varonil'); // Default Lineup Filter
    const [dragOver, setDragOver] = useState(null);
    const collections = getCollections(userId);

    // Nuevo estado para el libero
    const [liberoId, setLiberoId] = useState(null);

    useEffect(() => { if(db && userId) onSnapshot(query(collection(db, collections.JUGADORES)), s => setPlayers(s.docs.map(d=>({id:d.id,...d.data()}))), e=>console.log(e)); }, [db, userId]);
    
    const handleDrop = (pos, pid) => {
        setDragOver(null);
        // Si el jugador arrastrado es libero, y la posición no es la de "libero especial", no permitir si ya hay uno? No, la validación se hace al guardar.
        setLineup(p => { const n={...p}; Object.keys(n).forEach(k=>{if(n[k]===pid)delete n[k]}); n[pos]=pid; return n; });
    };

    const handleDropLibero = (pid) => {
        // Verificar si el jugador ya está en la alineación titular
        const isInLineup = Object.values(lineup).includes(pid);
        if (isInLineup) {
            showToast("El jugador ya está en la alineación titular", "error");
            return;
        }
        setLiberoId(pid);
    };


    const save = async () => { 
        if(!name || Object.keys(lineup).length!==6) return showToast("Completa la alineación y el nombre", "error"); 
        
        // Validación de roles obligatorios
        const assignedIds = Object.values(lineup);
        const assignedPlayers = players.filter(p => assignedIds.includes(p.id));
        
        const count = (role) => assignedPlayers.filter(p => p.posicion === role).length;
        
        if (count('Punta') !== 2) return showToast("Debe haber exactamente 2 Puntas", "error");
        if (count('Central') !== 2) return showToast("Debe haber exactamente 2 Centrales", "error");
        if (count('Opuesto') !== 1 && count('Armador') !== 1) return showToast("Debe haber 1 Opuesto y 1 Armador (o 2 Opuesto/Armador)", "error");

        await addDoc(collection(db, collections.ALINEACIONES), {
            nombre: name, 
            formacion: lineup, 
            libero: liberoId, // Guardar el libero opcional
            createdBy: userId
        }); 
        setName(''); 
        setLineup({});
        setLiberoId(null);
        showToast("Alineación guardada", "success"); 
    };
    
    const assignedIds = Object.values(lineup);
    if(liberoId) assignedIds.push(liberoId);

    const availablePlayers = players.filter(p => !assignedIds.includes(p.id) && (filter === 'TODOS' || p.posicion === filter) && (p.rama === filterRama));
    const liberoPlayer = players.find(p => p.id === liberoId);

    return (
        
        <div className="space-y-4 pb-20 grid-cols-2" style={{gridTemplateColumns: "repeat(2, minmax(0, 1fr))", display: "grid", gap: "11px"}}>

            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2"><h2 className="text-2xl font-black text-white tracking-tight">Creador de Alineaciones</h2></div>
                <div className="flex gap-2"><input className="flex-1 bg-gray-900 border-gray-600 border p-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition" placeholder="Nombre de la Alineación" value={name} onChange={e=>setName(e.target.value)}/><button onClick={save} className="bg-red-600 hover:bg-red-500 text-white px-6 rounded-lg font-bold shadow-lg transition">Guardar</button></div>
                {/* Visual Court Design for Drag & Drop */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10 pointer-events-none"></div>
                    <div className="text-center mb-2 text-xs font-bold text-gray-500 uppercase tracking-widest">Zona de Red ({filterRama})</div>
                    <div className="grid grid-cols-3 gap-2 relative z-10">
                        <div className="col-span-3 h-1 bg-white/20 mb-2 rounded"></div>
                        {POS.map(p => { 
                            const player = players.find(pl => pl.id === lineup[p.id]); 
                            const isOver = dragOver === p.id;
                            return (
                                <div 
                                    key={p.id} 
                                    onDragOver={e=>{e.preventDefault(); setDragOver(p.id)}} 
                                    onDragLeave={()=>setDragOver(null)}
                                    onDrop={e=>{const pid=e.dataTransfer.getData("id"); if(pid) handleDrop(p.id, pid)}} 
                                    draggable={!!player} 
                                    onDragStart={e=>player && e.dataTransfer.setData("id", player.id)} 
                                    className={`h-24 rounded-lg flex flex-col items-center justify-center border-2 transition-all duration-200 relative group
                                        ${isOver ? 'border-emerald-400 bg-emerald-900/30 scale-105 shadow-emerald-500/20 shadow-lg' : 'border-dashed border-gray-600 bg-gray-900/50'} 
                                        ${player ? 'border-solid border-red-500 bg-gray-800 shadow-md cursor-grab active:cursor-grabbing' : ''}`
                                    }
                                >
                                    <span className="absolute top-1 left-2 text-[10px] font-black text-gray-600 opacity-50">P{p.l}</span>
                                    {player ? (
                                        <>
                                            <div className="w-8 h-8 rounded-full bg-gray-700 mb-1 overflow-hidden border border-gray-500">{player.fotografia && <img src={player.fotografia} className="w-full h-full object-cover"/>}</div>
                                            <span className="text-xs font-bold text-white leading-tight">{player.nombre}</span>
                                            <span className="text-[9px] text-red-400">{player.posicion}</span>
                                            <button onClick={()=>setLineup(prev=>{const n={...prev}; delete n[p.id]; return n;})} className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 text-white opacity-0 group-hover:opacity-100 transition"><X size={10}/></button>
                                        </>
                                    ) : <span className="text-xs text-gray-500 font-medium">Vacío</span>}
                                </div>
                            ) 
                        })}
                    </div>
            </div>

            {/* Area de Libero */}
             <div 
                onDragOver={e=>e.preventDefault()} 
                onDrop={e=>{const pid=e.dataTransfer.getData("id"); if(pid) handleDropLibero(pid)}} 
                className={`bg-gray-800 p-4 rounded-xl border-2 border-dashed ${liberoPlayer ? 'border-emerald-500 bg-emerald-900/10' : 'border-gray-600'} flex items-center justify-between`}
            >
                <div className="flex items-center">
                    <div className="mr-3 p-2 bg-yellow-500/20 rounded-full text-yellow-500"><Shirt size={20}/></div>
                    <div>
                        <p className="text-sm font-bold text-gray-300 uppercase tracking-widest">Líbero (Opcional)</p>
                        {liberoPlayer ? (
                             <p className="text-emerald-400 font-bold text-sm">{liberoPlayer.nombre}</p>
                        ) : (
                             <p className="text-gray-500 text-xs">Arrastra aquí un jugador</p>
                        )}
                    </div>
                </div>
                {liberoPlayer && <button onClick={()=>setLiberoId(null)} className="text-red-500 hover:bg-red-900/30 p-2 rounded"><Trash2 size={16}/></button>}
            </div>

            </div>
            {/* Bench Area */}
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest flex items-center"><Users className="w-4 h-4 mr-2"/> Banca / Disponibles</h3>
                    <div className="flex gap-2">
                        <button onClick={()=>setFilterRama(filterRama === 'Varonil' ? 'Femenil' : 'Varonil')} className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-[10px] font-bold text-white hover:bg-gray-600 flex items-center">
                            {filterRama === 'Varonil' ? <span className="text-blue-300">Varonil</span> : <span className="text-pink-300">Femenil</span>}
                            <RotateCcw className="w-3 h-3 ml-1" />
                        </button>
                    </div>
                </div>
                <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                    {['TODOS','Punta','Central','Líbero','Arm','Op'].map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-2 py-0.5 rounded text-[10px] font-bold ${filter===f?'bg-red-600 text-white':'bg-gray-700 text-gray-400'}`}>{f}</button>)}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 min-h-[90px] scrollbar-thin scrollbar-thumb-gray-600">
                    {availablePlayers.length > 0 ? availablePlayers.map(p => (
                        <div key={p.id} draggable onDragStart={e=>e.dataTransfer.setData("id", p.id)} className="bg-gray-900 p-2 rounded-lg shadow border border-gray-600 min-w-[90px] w-[90px] flex flex-col items-center cursor-grab active:cursor-grabbing hover:border-red-500 transition group">
                            <div className="w-8 h-8 rounded-full bg-gray-700 mb-1 overflow-hidden">{p.fotografia && <img src={p.fotografia} className="w-full h-full object-cover"/>}</div>
                            <p className="text-xs font-bold truncate text-gray-200 w-full text-center">{p.nombre}</p>
                            <p className="text-[9px] text-gray-500">{p.posicion}</p>
                            <GripVertical className="w-3 h-3 text-gray-600 mt-1 opacity-0 group-hover:opacity-100 transition"/>
                        </div>
                    )) : <p className="text-xs text-gray-500 w-full text-center py-4">No hay jugadores disponibles.</p>}
                </div>
            </div>
        </div>
    )
};

const StaffManager = ({ db, userId, showToast }) => {
    const [staff, setStaff] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const collections = getCollections(userId);

    useEffect(() => { if(db && userId) onSnapshot(query(collection(db, collections.STAFF)), s => setStaff(s.docs.map(d=>({id:d.id,...d.data()})))); }, [db, userId]);
    const deleteStaff = async (id) => { if(confirm("Eliminar?")) await deleteDoc(doc(db, collections.STAFF, id)); }
    return (<div className="space-y-4"><button onClick={()=>setIsModalOpen(true)} className="w-full bg-gray-800 text-red-500 p-3 rounded-lg font-bold border border-gray-700 hover:bg-gray-700 transition">+ Nuevo Miembro</button><div className="space-y-2">{staff.map(s=>(<div key={s.id} className="bg-gray-800 p-3 rounded-lg shadow border border-gray-700 flex justify-between items-center"><div><p className="font-bold text-gray-200">{s.nombre}</p><p className="text-xs text-gray-500">{s.puesto}</p></div><button onClick={()=>deleteStaff(s.id)} className="text-red-500 hover:text-red-400"><Trash2 size={16}/></button></div>))}</div><AddStaffModal db={db} userId={userId} isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)}/></div>);
};

const AssignStaffManager = ({ db, userId }) => {
    const [staff, setStaff] = useState([]);
    const [lineups, setLineups] = useState([]);
    const collections = getCollections(userId);

    useEffect(() => { if(db && userId) { onSnapshot(query(collection(db, collections.STAFF)), s=>setStaff(s.docs.map(d=>({id:d.id,...d.data()})))); onSnapshot(query(collection(db, collections.ALINEACIONES)), s=>setLineups(s.docs.map(d=>({id:d.id,...d.data()})))); } }, [db, userId]);
    const assign = async (lid, sid) => { await updateDoc(doc(db, collections.ALINEACIONES, lid), { staff_id: sid }); };
    return (<div className="space-y-3">{lineups.map(l => (<div key={l.id} className="bg-gray-800 p-3 rounded shadow border-l-4 border-emerald-600"><p className="font-bold text-sm mb-1 text-gray-200">{l.nombre}</p><select className="w-full border border-gray-600 text-xs p-2 rounded bg-gray-700 text-white" value={l.staff_id||""} onChange={e=>assign(l.id, e.target.value)}><option value="">Sin Asignar</option>{staff.map(s=><option key={s.id} value={s.id}>{s.nombre} ({s.puesto})</option>)}</select></div>))}</div>);
};

const ConfigManager = ({ db, userId, showToast }) => {
    const [tab, setTab] = useState('STAFF');
    return (<div className="space-y-6 pb-20"><h2 className="text-2xl font-black text-white tracking-tight">Configuración</h2><div className="flex bg-gray-800 p-1 rounded-lg border border-gray-700">{[{id: 'STAFF', label: 'Staff'}, {id: 'ASSIGN', label: 'Asignar'}].map(t => (<button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${tab === t.id ? 'bg-gray-700 text-white shadow-sm border border-gray-600' : 'text-gray-500 hover:text-gray-300'}`}>{t.label}</button>))}</div>{tab === 'STAFF' && <StaffManager db={db} userId={userId} />}{tab === 'ASSIGN' && <AssignStaffManager db={db} userId={userId} />}</div>);
};

const NAVIGATION = { DASHBOARD: 'Plantilla', PARTIDOS: 'Partidos', ASISTENCIA: 'Asistencia', PAGOS: 'Pagos', ALINEACIONES: 'Alineaciones', CONFIG: 'Config', TRACKER: 'Tracker', TRAINING_TRACKER: 'TrainingTracker' };

// --- APP PRINCIPAL ---
export default function App() {
    const { db, userId, isAuthReady, error, loginWithGoogle, logout, userName, userPhoto, isOffline } = useFirebase();
    const [view, setView] = useState(NAVIGATION.DASHBOARD);
    const [trackedMatch, setTrackedMatch] = useState(null);
    const [trackedSession, setTrackedSession] = useState(null); // Nueva sesión de tracking
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    const handleStartTracking = (id, match) => { setTrackedMatch(match); setView(NAVIGATION.TRACKER); };
    const handleStartTrainingTracking = (session) => { setTrackedSession(session); setView(NAVIGATION.TRAINING_TRACKER); };
    const handleGoBack = () => { setTrackedMatch(null); setTrackedSession(null); setView(NAVIGATION.PARTIDOS); };
    const handleGoBackTraining = () => { setTrackedSession(null); setView(NAVIGATION.ASISTENCIA); };

    if (error) return <div className="p-8 text-red-500 text-center font-bold">Error: {error}</div>;
    if (!isAuthReady || !db) return <LoadingIndicator />;
    
    if (!userId) return <LoginScreen onLogin={loginWithGoogle} isOffline={isOffline} />;

    const renderContent = () => {
        switch (view) {
            case NAVIGATION.DASHBOARD: return <PlayerList db={db} userId={userId} showToast={showToast} />;
            case NAVIGATION.PARTIDOS: return <MatchesList db={db} userId={userId} onStartTracking={handleStartTracking} showToast={showToast} />;
            case NAVIGATION.ASISTENCIA: return <AttendanceManager db={db} userId={userId} showToast={showToast} onOpenTracker={handleStartTrainingTracking} />;
            case NAVIGATION.PAGOS: return <PaymentsManager db={db} userId={userId} showToast={showToast} />;
            case NAVIGATION.ALINEACIONES: return <LineupManager db={db} userId={userId} showToast={showToast} />;
            case NAVIGATION.TRACKER: return trackedMatch ? <MatchTracker db={db} userId={userId} match={trackedMatch} onGoBack={handleGoBack} showToast={showToast} /> : <div>Error</div>;
            case NAVIGATION.TRAINING_TRACKER: return trackedSession ? <TrainingTracker db={db} userId={userId} session={trackedSession} onGoBack={handleGoBackTraining} showToast={showToast} /> : <div>Error</div>;
            case NAVIGATION.CONFIG: return <ConfigManager db={db} userId={userId} showToast={showToast} />;
            default: return <PlayerList db={db} userId={userId} showToast={showToast} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-red-500 selection:text-white">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {isOffline && view !== NAVIGATION.TRACKER && view !== NAVIGATION.TRAINING_TRACKER && (
                <div className="bg-yellow-600 text-white text-xs font-bold text-center py-1 px-4 flex items-center justify-center">
                    <WifiOff className="w-3 h-3 mr-2"/> Modo Offline: Los cambios se guardarán localmente y se sincronizarán al recuperar la conexión.
                </div>
            )}
            {view !== NAVIGATION.TRACKER && view !== NAVIGATION.TRAINING_TRACKER && (
                <header className="bg-gray-800 shadow-lg border-b border-gray-700 p-4 sticky top-0 z-20 flex justify-between items-center">
                    <h1 className="text-xl font-black text-white tracking-tighter flex items-center"><Volleyball className="w-5 h-5 text-red-600 mr-2"/> VoleyStats</h1>
                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-gray-200">{userName}</p>
                            <button onClick={logout} className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase tracking-wider">Cerrar Sesión</button>
                        </div>
                        {userPhoto ? <img src={userPhoto} className="w-9 h-9 rounded-full border-2 border-red-600" alt="User"/> : <div className="w-9 h-9 rounded-full bg-gray-700 text-red-500 flex items-center justify-center font-bold text-xs border border-gray-600">{userName?.[0]}</div>}
                        <button onClick={logout} className="sm:hidden text-gray-400 hover:text-white"><LogOut className="w-5 h-5"/></button>
                    </div>
                </header>
            )}
            <main className="max-w-3x2 mx-auto p-4">{renderContent()}</main>
            {view !== NAVIGATION.TRACKER && view !== NAVIGATION.TRAINING_TRACKER && (
                <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex justify-around p-2 z-30 pb-safe shadow-[0_-5px_10px_rgba(0,0,0,0.3)]">
                    {[ { id: NAVIGATION.DASHBOARD, icon: Users }, { id: NAVIGATION.PARTIDOS, icon: Calendar }, { id: NAVIGATION.ASISTENCIA, icon: ClipboardList }, { id: NAVIGATION.PAGOS, icon: CreditCard }, { id: NAVIGATION.ALINEACIONES, icon: Shield }, { id: NAVIGATION.CONFIG, icon: Settings } ].map(item => (
                        <button key={item.id} onClick={() => setView(item.id)} className={`flex flex-col items-center p-2 rounded-xl transition duration-200 ${view === item.id ? 'text-red-500 bg-gray-700 shadow-inner' : 'text-gray-500 hover:text-gray-300'}`}>
                            <item.icon className="w-6 h-6 mb-1" strokeWidth={view === item.id ? 3 : 2} /><span className="text-[10px] font-bold uppercase tracking-wider">{item.id === 'Alineaciones' ? 'Alinea' : item.id}</span>
                        </button>
                    ))}
                </nav>
            )}
        </div>
    );
}
