import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { BookOutlined, HomeOutlined, AppstoreOutlined, ExperimentOutlined } from '@ant-design/icons';
import HomePage from '../pages/HomePage';
import NovelManagementPage from '../pages/NovelManagementPage.tsx';
import ManagerPage from '../pages/manager';
import TownVisualizationPage from '../pages/town/[novelId]';
import SceneDetailPage from '../pages/town/scene/[sceneId]';
import CharacterDetailPage from '../pages/town/character/[characterId]';
import PlotWeavingPage from '../pages/weaving/PlotWeavingPage';
import PlotIntervenePage from '../pages/weaving/PlotIntervenePage';
import PlotInterveneDetailPage from '../pages/weaving/PlotInterveneDetailPage';
import PlotPredictPage from '../pages/weaving/PlotPredictPage';
import './App.css';

function AppRoutes() {
  const location = useLocation();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/novel-management" element={<NovelManagementPage />} />
      <Route path="/manager" element={<ManagerPage />} />
      <Route path="/town/:novelId" element={<TownVisualizationPage key={location.pathname} />} />
      <Route path="/town/:novelId/scene/:sceneId" element={<SceneDetailPage />} />
      <Route path="/town/:novelId/character/:characterId" element={<CharacterDetailPage />} />
      <Route path="/weaving" element={<PlotWeavingPage />} />
      <Route path="/weaving/:novelId/intervene" element={<PlotIntervenePage />} />
      <Route path="/weaving/:novelId/intervene/:plotId" element={<PlotInterveneDetailPage />} />
      <Route path="/weaving/:novelId/predict" element={<PlotPredictPage />} />
    </Routes>
  );
}

const navItems = [
  { path: '/', label: '首页', icon: <HomeOutlined /> },
  { path: '/novel-management', label: '小说管理', icon: <BookOutlined /> },
  { path: '/manager', label: '管理中心', icon: <AppstoreOutlined /> },
  { path: '/weaving', label: '情节编织坊', icon: <ExperimentOutlined /> },
];

function Navbar() {
  const location = useLocation();

  return (
    <nav className="nav">
      <div className="nav-brand">
        <div className="nav-logo">
          <BookOutlined style={{ fontSize: 20 }} />
        </div>
        <span className="nav-title">童话镇</span>
      </div>
      <div className="nav-links">
        {navItems.map(item => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <span className="nav-link-icon">{item.icon}</span>
              <span className="nav-link-text">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navbar />
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
