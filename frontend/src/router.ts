import { createRouter, createWebHistory } from 'vue-router'
import Home from './pages/Home.vue'
import Problems from './pages/Problems.vue'
import ProblemDetail from './pages/ProblemDetail.vue'
import Submissions from './pages/Submissions.vue'
import SubmissionDetail from './pages/SubmissionDetail.vue'
import Rankings from './pages/Rankings.vue'
import Login from './pages/Login.vue'
import Register from './pages/Register.vue'
import UserCenter from './pages/UserCenter.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/problems', component: Problems },
    { path: '/problem/:slug', component: ProblemDetail, props: true },
    { path: '/submissions', component: Submissions },
    { path: '/submission/:id', component: SubmissionDetail, props: true },
    { path: '/rankings', component: Rankings },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/me', component: UserCenter },
  ],
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach((to) => {
  const protectedPaths = ['/submissions', '/me']
  if (protectedPaths.some(p => to.path.startsWith(p)) && !localStorage.getItem('etoj_token')) {
    return '/login'
  }
  if ((to.path === '/login' || to.path === '/register') && localStorage.getItem('etoj_token')) {
    return '/'
  }
})

export default router
