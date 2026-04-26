import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="nav">
          <Link to="/" className="nav-link">首页</Link>
          <Link to="/novel-management" className="nav-link">小说管理</Link>
          <Link to="/manager" className="nav-link">管理中心</Link>
          <Link to="/weaving" className="nav-link">情节编织坊</Link>
        </nav>

        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
