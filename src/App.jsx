import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { QRCodeSVG } from 'qrcode.react'
import ApiKeyManager from './ApiKeyManager.jsx'
import {
  Activity, AlertTriangle, ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote,
  Bell, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Download, Eye, EyeOff, FileText, FileUp, Filter, HandCoins, IndianRupee,
  Landmark, Languages, LayoutDashboard, Menu, MoreHorizontal, Plus, Search,
  LockKeyhole, LogOut, ShieldCheck, Sun, Moon, TrendingUp, UserRound,
  UsersRound, Wallet, X,
} from 'lucide-react'

const initialLoans = [
  { id: 'LN-2408', name: 'Priya Sharma', phone: '919876543210', type: 'Business', principal: 250000, paid: 118000, interestPaid: 14300, installmentsPaid: 5, installment: 22500, due: 'Today', status: 'Due today', risk: 'Low risk', frequency: 'Monthly', term: 12, rate: 2, start: '2026-04-23', address: 'Indiranagar, Bengaluru', assignedAgent: 'Arjun Kumar' },
  { id: 'LN-2407', name: 'Ramesh Patel', phone: '919876543211', type: 'Gold loan', principal: 180000, paid: 0, interestPaid: 7200, installmentsPaid: 4, installment: 3600, due: 'Today', status: 'Due today', risk: 'Moderate', frequency: 'Monthly', term: 12, rate: 2, start: '2026-06-23', address: 'Vijay Nagar, Indore', repaymentType: 'Girvi', maturityDate: '2027-06-23', collateral: 'Gold ornaments · 42g, 22K' },
  { id: 'LN-2406', name: 'Ananya Desai', phone: '919876543212', type: 'Personal', principal: 120000, paid: 48000, interestPaid: 9600, installmentsPaid: 4, installment: 11000, due: 'Overdue 5d', status: 'Overdue', risk: 'High risk', frequency: 'Monthly', term: 12, rate: 2.5, start: '2026-05-18', address: 'Navrangpura, Ahmedabad', assignedAgent: 'Arjun Kumar' },
  { id: 'LN-2405', name: 'Vikram Singh', phone: '919876543213', type: 'Vehicle', principal: 320000, paid: 160000, interestPaid: 16000, installmentsPaid: 6, installment: 29500, due: 'Tomorrow', status: 'Upcoming', risk: 'Low risk', frequency: 'Monthly', term: 12, rate: 2, start: '2026-01-18', address: 'Baner, Pune' },
  { id: 'LN-2404', name: 'Meera Iyer', phone: '919876543214', type: 'Business', principal: 200000, paid: 200000, interestPaid: 36000, installmentsPaid: 12, installment: 19000, due: 'Completed', status: 'Paid off', risk: 'Low risk', frequency: 'Monthly', term: 12, rate: 1.8, start: '2025-10-03', address: 'Adyar, Chennai' },
]

const ONLINE_FLOW_STORAGE_KEY = 'lendpro-online-loan-flow-v1'
const ONLINE_FLOW_FIELDS = ['principal', 'installment', 'rate', 'paid', 'interestPaid', 'installmentsPaid', 'approvalState', 'sanctionedAmount', 'sanctionedRate', 'agreementAcceptedAt', 'activationPayment', 'disbursementStage']
const sanitizeOnlineFlowPatch = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const patch = {}
  if (Number.isFinite(value.principal) && value.principal > 0) patch.principal = value.principal
  if (Number.isFinite(value.installment) && value.installment >= 0) patch.installment = value.installment
  if (Number.isFinite(value.rate) && value.rate >= 0 && value.rate <= 100) patch.rate = value.rate
  for (const field of ['paid', 'interestPaid', 'installmentsPaid']) {
    if (Number.isFinite(value[field]) && value[field] >= 0) patch[field] = value[field]
  }
  if (['UNDER_REVIEW', 'APPROVED', 'SANCTIONED', 'PAYMENT_PENDING', 'ACTIVE'].includes(value.approvalState)) patch.approvalState = value.approvalState
  for (const field of ['sanctionedAmount', 'sanctionedRate']) {
    if (value[field] === null) patch[field] = null
    else if (Number.isFinite(value[field]) && value[field] >= 0) patch[field] = value[field]
  }
  if (typeof value.agreementAcceptedAt === 'string' && value.agreementAcceptedAt.length < 40) patch.agreementAcceptedAt = value.agreementAcceptedAt
  if (typeof value.disbursementStage === 'string' && ['Under review', 'Offer available', 'Payment reported · verification pending', 'Disbursed'].includes(value.disbursementStage)) patch.disbursementStage = value.disbursementStage
  if (value.activationPayment === null) patch.activationPayment = null
  else if (value.activationPayment && typeof value.activationPayment === 'object'
    && /^\d{12}$/.test(value.activationPayment.reference)
    && Number.isFinite(value.activationPayment.amount) && value.activationPayment.amount >= 0
    && typeof value.activationPayment.submittedAt === 'string'
    && ['REPORTED_PENDING_VERIFICATION', 'VERIFIED'].includes(value.activationPayment.status)
    && (value.activationPayment.status !== 'VERIFIED'
      || (typeof value.activationPayment.verifiedAt === 'string'
        && /^\d{12}$/.test(value.activationPayment.disbursementUtr)))) {
    const activationPayment = {
      reference: value.activationPayment.reference,
      amount: value.activationPayment.amount,
      submittedAt: value.activationPayment.submittedAt.slice(0, 40),
      status: value.activationPayment.status,
    }
    if (typeof value.activationPayment.verifiedAt === 'string') activationPayment.verifiedAt = value.activationPayment.verifiedAt.slice(0, 40)
    if (typeof value.activationPayment.disbursementUtr === 'string' && /^\d{12}$/.test(value.activationPayment.disbursementUtr)) activationPayment.disbursementUtr = value.activationPayment.disbursementUtr
    patch.activationPayment = activationPayment
  }
  return patch
}
const isCapitalizedLoan = (loan) => !loan.approvalState
  || (loan.approvalState === 'ACTIVE' && loan.activationPayment?.status !== 'REPORTED_PENDING_VERIFICATION')
const printDocument = (target) => {
  const cleanup = () => { delete document.body.dataset.printTarget }
  document.body.dataset.printTarget = target
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
  window.setTimeout(cleanup, 1000)
}
const readOnlineFlow = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(ONLINE_FLOW_STORAGE_KEY) || '{}')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    return Object.fromEntries(Object.entries(saved)
      .filter(([id]) => /^LN-[A-Z0-9-]{1,32}$/i.test(id))
      .map(([id, patch]) => [id, sanitizeOnlineFlowPatch(patch)]))
  } catch (error) {
    console.error('Could not read the online loan workflow cache:', error)
    return {}
  }
}
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0)
const frequencyFactor = (frequency) => ({ Daily: 12 / 365, Weekly: 12 / 52, Monthly: 1, Yearly: 12 }[frequency] || 1)
const calculateInstallment = (principal, rate, term, frequency, method) => {
  const periodRate = rate * frequencyFactor(frequency) / 100
  if (method === 'Reducing balance · EMI') {
    const factor = (1 + periodRate) ** term
    return Math.round(periodRate ? principal * periodRate * factor / (factor - 1) : principal / term)
  }
  return Math.round(principal / term + principal * periodRate)
}
const addFrequency = (date, frequency, periods) => {
  const next = new Date(date)
  if (frequency === 'Daily') next.setDate(next.getDate() + periods)
  else if (frequency === 'Weekly') next.setDate(next.getDate() + periods * 7)
  else if (frequency === 'Yearly') next.setFullYear(next.getFullYear() + periods)
  else next.setMonth(next.getMonth() + periods)
  return next
}
const dueDateFor = (loan) => {
  const index = Math.min(loan.installmentsPaid || 0, Math.max(0, (loan.term || 1) - 1))
  if (loan.repaymentType === 'Girvi' && index === loan.term - 1 && loan.maturityDate) return new Date(`${loan.maturityDate}T00:00:00`)
  return addFrequency(new Date(`${loan.start}T00:00:00`), loan.frequency, index + 1)
}
const daysPastDueFor = (loan, now = new Date()) => {
  const due = dueDateFor(loan)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  return Math.max(0, Math.floor((today.getTime() - dueDay.getTime()) / 86400000))
}
const lateFeeFor = (loan, policy, now = new Date()) => {
  if (loan.status === 'Paid off'
    || loan.activationPayment?.status === 'REPORTED_PENDING_VERIFICATION'
    || (loan.approvalState && loan.approvalState !== 'ACTIVE')
    || (loan.disbursementStage && loan.disbursementStage !== 'Disbursed' && loan.approvalState !== 'ACTIVE')) return 0
  const accrued = Math.max(0, daysPastDueFor(loan, now) - policy.grace) * policy.perDay
  return Math.max(0, accrued - (loan.penaltyPaid || 0))
}
const loanStatusFor = (loan, policy, now = new Date()) => {
  if (loan.status === 'Paid off') return 'Paid off'
  if (loan.approvalState === 'UNDER_REVIEW') return 'Under review'
  if (loan.approvalState === 'APPROVED') return 'Approved'
  if (loan.approvalState === 'SANCTIONED') return 'Sanctioned'
  if (loan.approvalState === 'PAYMENT_PENDING') return 'Payment pending'
  if (loan.approvalState === 'ACTIVE' && loan.activationPayment?.status === 'REPORTED_PENDING_VERIFICATION') return 'Active · verification pending'
  if (loan.disbursementStage && loan.disbursementStage !== 'Disbursed' && loan.approvalState !== 'ACTIVE') return 'Processing'
  const daysLate = daysPastDueFor(loan, now)
  if (daysLate > 0) return lateFeeFor(loan, policy, now) > 0 ? 'Overdue with Penalty' : 'Overdue'
  const due = dueDateFor(loan)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate()
    ? 'Due today'
    : 'Upcoming'
}
const presentLoan = (loan, policy, now = new Date()) => {
  const daysLate = daysPastDueFor(loan, now)
  const penalty = lateFeeFor(loan, policy, now)
  const dueDate = dueDateFor(loan)
  const status = loanStatusFor(loan, policy, now)
  const due = status.startsWith('Overdue')
    ? `Overdue ${daysLate}d`
    : status === 'Due today'
      ? 'Today'
      : status === 'Paid off'
        ? 'Completed'
        : status === 'Processing'
          ? 'Processing'
          : dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
  return { ...loan, status, due, overdueDays: daysLate, overduePenalty: penalty, penaltyPerDay: policy.perDay, graceDays: policy.grace, installment: installmentDue(loan) }
}
const creditRiskAssessment = ({ monthlyIncome, collateralValue, loanAmount, history, averageBalance }) => {
  const income = Math.max(0, Number(monthlyIncome) || 0)
  const balance = Math.max(0, Number(averageBalance) || 0)
  const ltv = Number(collateralValue) > 0 ? Math.max(0, Number(loanAmount) || 0) / Number(collateralValue) : null
  const repaid = history.filter((loan) => loan.status === 'Paid off').length
  const overdue = history.filter((loan) => ['Overdue', 'Overdue with Penalty'].includes(loan.status)).length
  const base = 580 + Math.min(140, Math.floor(income / 1000))
  const cashflow = income ? Math.max(-100, Math.min(70, Math.round((balance / income - 1) * 35))) : -100
  const security = ltv === null ? 0 : ltv <= 0.5 ? 80 : ltv <= 0.7 ? 45 : ltv <= 0.85 ? 5 : -80
  const record = Math.min(70, repaid * 18) - overdue * 55
  const score = Math.max(300, Math.min(900, base + cashflow + security + record))
  return { score, risk: score >= 700 ? 'Low' : score >= 560 ? 'Medium' : 'High', ltv }
}
const parseStatementCsv = (source) => {
  const rows = source.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, '').replaceAll('""', '"')))
  if (rows.length < 2) throw new Error('The CSV has no transaction rows.')
  const header = rows[0].map((cell) => cell.toLowerCase())
  const dateIndex = header.findIndex((cell) => /date/.test(cell))
  const balanceIndex = header.findIndex((cell) => /balance/.test(cell))
  if (dateIndex < 0 || balanceIndex < 0) throw new Error('CSV needs transaction date and closing balance columns.')
  const monthly = new Map()
  rows.slice(1).forEach((row) => {
    const rawDate = row[dateIndex] || ''
    const slashDate = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    const date = slashDate
      ? new Date(Number(slashDate[3]), Number(slashDate[2]) - 1, Number(slashDate[1]))
      : new Date(rawDate)
    const balance = Number(String(row[balanceIndex] || '').replace(/[₹,\s]/g, ''))
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(balance)) return
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const entry = monthly.get(month) || { sum: 0, count: 0 }
    entry.sum += balance
    entry.count += 1
    monthly.set(month, entry)
  })
  if (monthly.size < 3) throw new Error('The CSV must include transaction balances from at least three distinct months.')
  const averages = [...monthly.entries()].sort(([monthA], [monthB]) => monthA.localeCompare(monthB)).slice(-3).map(([, entry]) => entry.sum / entry.count)
  return { averageMonthlyBalance: Math.round(averages.reduce((sum, value) => sum + value, 0) / averages.length), monthCount: 3 }
}
const foreclosureDue = (loan, policy) => Math.max(0, loan.principal - loan.paid)
  + (loan.repaymentType === 'Girvi' ? Math.round(loan.principal * loan.rate * frequencyFactor(loan.frequency) / 100) : 0)
  + lateFeeFor(loan, policy)
const installmentDue = (loan) => {
  const index = Math.min(loan.installmentsPaid || 0, Math.max(0, loan.term - 1))
  const interest = Math.round(loan.principal * loan.rate * frequencyFactor(loan.frequency) / 100)
  return loan.repaymentType === 'Girvi'
    ? interest + (index === loan.term - 1 ? loan.principal : 0)
    : loan.installment
}
const normalizeMobile = (value) => String(value).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '')
const authenticateIdentity = (role, identifier, loans, borrowers = []) => {
  const value = identifier.trim().toUpperCase()
  const mobile = normalizeMobile(identifier)
  if (role === 'Admin' && (value === 'AD-01' || mobile === '9900000001')) {
    return { displayName: 'Saanvi Patel', reference: 'AD-01' }
  }
  if (role === 'Agent' && (value === 'AG-01' || mobile === '9800000002')) {
    return { displayName: 'Arjun Kumar', reference: 'AG-01' }
  }
  if (role === 'Borrower') {
    const borrower = borrowers.find((item) => normalizeMobile(item.phone) === mobile)
    if (borrower) {
      const borrowerLoan = loans.find((item) => normalizeMobile(item.phone) === mobile)
      return {
        ...borrower,
        displayName: borrower.name,
        reference: borrowerLoan?.id || borrower.phone,
        loanId: borrowerLoan?.id,
      }
    }
    const loan = loans.find((item) => item.id.toUpperCase() === value)
      || loans.find((item) => normalizeMobile(item.phone) === mobile)
    if (loan) return { displayName: loan.name, reference: loan.id, loanId: loan.id, phone: loan.phone, email: loan.email }
  }
  return null
}
const buildSchedule = (loan) => {
  let balance = loan.principal
  const periodRate = loan.rate * frequencyFactor(loan.frequency) / 100
  return Array.from({ length: loan.term }, (_, index) => {
    const interest = Math.round((loan.interestMethod === 'Reducing balance · EMI' && loan.repaymentType !== 'Girvi' ? balance : loan.principal) * periodRate)
    const principal = loan.repaymentType === 'Girvi'
      ? index === loan.term - 1 ? balance : 0
      : loan.interestMethod === 'Reducing balance · EMI'
      ? Math.min(balance, loan.installment - interest)
      : index === loan.term - 1
        ? balance
        : Math.round(loan.principal / loan.term)
    balance = Math.max(0, balance - principal)
    return {
      number: index + 1,
      date: loan.repaymentType === 'Girvi' && index === loan.term - 1 && loan.maturityDate
        ? new Date(`${loan.maturityDate}T00:00:00`)
        : addFrequency(new Date(loan.start), loan.frequency, index + 1),
      principal,
      interest,
      installment: principal + interest,
      balanceAfterDue: Math.max(0, balance - principal),
      status: index < (loan.installmentsPaid || 0) ? 'Paid' : index === (loan.installmentsPaid || 0) && loan.status.startsWith('Overdue') ? 'Overdue' : 'Pending',
    }
  })
}
const navItems = [
  { id: 'Overview', icon: LayoutDashboard },
  { id: 'Loans', icon: HandCoins, count: '24' },
  { id: 'Collections', icon: Wallet },
  { id: 'Borrowers', icon: UsersRound },
  { id: 'Reports', icon: FileText },
]

function App() {
  const [loans, setLoans] = useState(() => {
    const persistedFlow = readOnlineFlow()
    return initialLoans.map((loan) => ({ ...loan, ...(persistedFlow[loan.id] || {}) }))
  })
  const [role, setRole] = useState('Admin')
  const [authenticated, setAuthenticated] = useState(false)
  const [loginRole, setLoginRole] = useState('Admin')
  const [registering, setRegistering] = useState(false)
  const [borrowerAccounts, setBorrowerAccounts] = useState([])
  const [registration, setRegistration] = useState({ name: '', pin: '', phone: '', email: '', language: 'EN', referral: '' })
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [sessionIdentity, setSessionIdentity] = useState(null)
  const [verificationMode, setVerificationMode] = useState('PIN')
  const [pin, setPin] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [pinVisible, setPinVisible] = useState(false)
  const [pinError, setPinError] = useState('')
  const [pinCodes, setPinCodes] = useState({ Admin: '1234', Agent: '2233', Borrower: '5566' })
  const [profilePinForm, setProfilePinForm] = useState({ current: '', next: '', confirm: '' })
  const [page, setPage] = useState('Overview')
  const [theme, setTheme] = useState('dark')
  const [language, setLanguage] = useState('EN')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [modal, setModal] = useState('')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState('')
  const [lateFee, setLateFee] = useState({ grace: 3, perDay: 50, vpa: 'lender@upi' })
  const [now, setNow] = useState(() => Date.now())
  const [notificationsPermission, setNotificationsPermission] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const notifiedDueRef = useRef(new Set())
  const [kycFiles, setKycFiles] = useState({ aadhaar: '', pan: '' })
  const [receiptBreakdown, setReceiptBreakdown] = useState({ principal: 0, interest: 0, fine: 0 })
  const [collectedToday, setCollectedToday] = useState(22000)
  const [agentCash, setAgentCash] = useState(12800)
  const [ownerCash, setOwnerCash] = useState(0)
  const [agentCommission, setAgentCommission] = useState(330)
  const [settlements, setSettlements] = useState([])
  const [paymentHistory, setPaymentHistory] = useState([
    { id: 'RC-728410', loanId: 'LN-2408', amount: 22500, date: '2026-10-02T10:42:00', mode: 'Cash', principal: 18000, interest: 4500, fine: 0 },
    { id: 'RC-718905', loanId: 'LN-2408', amount: 22500, date: '2026-09-02T12:18:00', mode: 'UPI QR', principal: 18000, interest: 4500, fine: 0 },
    { id: 'RC-706301', loanId: 'LN-2408', amount: 22000, date: '2026-08-02T11:06:00', mode: 'Bank transfer', principal: 18000, interest: 4000, fine: 0 },
  ])
  const [disbursement, setDisbursement] = useState({ mode: 'Cash in Hand', upiId: '', utr: '', bankName: '', accountNumber: '', ifsc: '' })
  const [disbursementReceipt, setDisbursementReceipt] = useState('')
  const [payment, setPayment] = useState({ amount: '', mode: 'Cash', utr: '', kind: 'Full payment' })
  const [newLoan, setNewLoan] = useState({ name: '', phone: '', alternatePhone: '', email: '', address: '', guarantorName: '', guarantorPhone: '', collateralReference: '', assignedAgent: '', type: 'Personal', principal: '', repaymentType: 'Regular EMI', maturityDate: '', interestMethod: 'Flat rate · Monthly', frequency: 'Monthly', term: '12', rate: '2', collateral: 'Gold ornaments', valuation: '' })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])
  const ledgerLoans = useMemo(() => loans.map((loan) => presentLoan(loan, lateFee, new Date(now))), [loans, lateFee, now])
  useEffect(() => {
    if (notificationsPermission !== 'granted' || !authenticated) return
    const visibleLoans = role === 'Borrower'
      ? ledgerLoans.filter((loan) => loan.id === sessionIdentity?.loanId)
      : role === 'Agent'
        ? ledgerLoans.filter((loan) => loan.assignedAgent === 'Arjun Kumar')
        : ledgerLoans
    visibleLoans.filter((loan) => loan.status === 'Due today' || loan.status.startsWith('Overdue')).forEach((loan) => {
      const key = `${loan.id}:${dueDateFor(loan).toISOString().slice(0, 10)}`
      if (notifiedDueRef.current.has(key)) return
      notifiedDueRef.current.add(key)
      new Notification('LendPro payment reminder', { body: 'A scheduled payment needs attention in your account.' })
    })
  }, [notificationsPermission, authenticated, role, sessionIdentity?.loanId, ledgerLoans])
  const activeLoans = ledgerLoans.filter((loan) => loan.status !== 'Paid off' && isCapitalizedLoan(loan))
  const outstanding = activeLoans.reduce((sum, loan) => sum + loan.principal - loan.paid + loan.overduePenalty, 0)
  const filteredLoans = useMemo(() => ledgerLoans.filter((loan) => {
    const matchesQuery = `${loan.name} ${loan.id} ${loan.type}`.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === 'All' || (filter === 'Overdue' ? loan.status.startsWith('Overdue') : loan.status === filter)
    return matchesQuery && matchesFilter
  }), [ledgerLoans, search, filter])
  const isAgent = role === 'Agent'
  const isBorrower = role === 'Borrower'
  const borrowerLoan = ledgerLoans.find((loan) => loan.id === sessionIdentity?.loanId)
  const borrowerHistory = ledgerLoans.filter((loan) => normalizeMobile(loan.phone) === normalizeMobile(sessionIdentity?.phone))
  const borrowerProfile = borrowerAccounts.find((account) => normalizeMobile(account.phone) === normalizeMobile(sessionIdentity?.phone))
    || { name: sessionIdentity?.displayName || borrowerLoan?.name || 'Borrower', phone: sessionIdentity?.phone || borrowerLoan?.phone || '', email: sessionIdentity?.email || borrowerLoan?.email || '', language }

  const notify = useCallback((message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }, [])
  const persistLoanFlow = useCallback((loanId, patch) => {
    try {
      const current = readOnlineFlow()
      const safePatch = sanitizeOnlineFlowPatch(Object.fromEntries(ONLINE_FLOW_FIELDS
        .filter((field) => Object.hasOwn(patch, field))
        .map((field) => [field, patch[field]])))
      window.localStorage.setItem(ONLINE_FLOW_STORAGE_KEY, JSON.stringify({
        ...current,
        [loanId]: { ...(current[loanId] || {}), ...safePatch },
      }))
    } catch (error) {
      console.error('Could not persist the online loan workflow cache:', error)
      notify('Workflow updated in this session, but local cross-tab sync is unavailable.')
    }
  }, [notify])
  const updateOnlineLoan = (loanId, patch) => {
    setLoans((current) => current.map((loan) => loan.id === loanId ? { ...loan, ...patch } : loan))
    setSelected((current) => current?.id === loanId ? { ...current, ...patch } : current)
    persistLoanFlow(loanId, patch)
  }
  const sanctionOnlineLoan = (loanId, amount, rate) => {
    const loan = loans.find((item) => item.id === loanId)
    const sanctionedAmount = Number(amount)
    const sanctionedRate = Number(rate)
    if (!loan || loan.approvalState !== 'UNDER_REVIEW' || !Number.isFinite(sanctionedAmount) || sanctionedAmount <= 0 || sanctionedAmount > loan.principal || !Number.isFinite(sanctionedRate) || sanctionedRate < 0 || sanctionedRate > 100) {
      notify('Use an amount up to the requested principal and a valid monthly rate.')
      return false
    }
    const installment = loan.repaymentType === 'Girvi'
      ? Math.round(sanctionedAmount * sanctionedRate * frequencyFactor(loan.frequency) / 100)
      : calculateInstallment(sanctionedAmount, sanctionedRate, loan.term, loan.frequency, loan.interestMethod)
    const patch = {
      principal: sanctionedAmount,
      installment,
      rate: sanctionedRate,
      sanctionedAmount,
      sanctionedRate,
      approvalState: sanctionedAmount === loan.principal && sanctionedRate === loan.rate ? 'APPROVED' : 'SANCTIONED',
      agreementAcceptedAt: '',
      activationPayment: null,
      disbursementStage: 'Offer available',
    }
    updateOnlineLoan(loanId, patch)
    notify(`${patch.approvalState === 'SANCTIONED' ? 'Modified offer sanctioned' : 'Loan approved'} for ${loan.name}.`)
    return true
  }
  const acceptOnlineOffer = (loanId) => {
    const loan = loans.find((item) => item.id === loanId)
    if (!loan || !['APPROVED', 'SANCTIONED'].includes(loan.approvalState)) {
      notify('This loan does not have an offer ready to accept.')
      return false
    }
    updateOnlineLoan(loanId, {
      approvalState: 'PAYMENT_PENDING',
      agreementAcceptedAt: new Date().toISOString(),
    })
    notify('Agreement accepted. Continue to the UPI payment step.')
    return true
  }
  const submitOnlineActivationPayment = (loanId, reference) => {
    const loan = loans.find((item) => item.id === loanId)
    if (!loan || loan.approvalState !== 'PAYMENT_PENDING' || !/^\d{12}$/.test(reference)) {
      notify('Enter a valid 12-digit UPI reference after accepting the offer.')
      return false
    }
    const activationPayment = {
      reference,
      amount: loan.installment,
      submittedAt: new Date().toISOString(),
      status: 'REPORTED_PENDING_VERIFICATION',
    }
    updateOnlineLoan(loanId, {
      approvalState: 'ACTIVE',
      disbursementStage: 'Payment reported · verification pending',
      activationPayment,
    })
    notify('Payment reference submitted. The lender must verify settlement before actual disbursement.')
    return true
  }
  const confirmOnlineDisbursement = (loanId, disbursementUtr) => {
    const loan = loans.find((item) => item.id === loanId)
    if (role !== 'Admin' || !loan || loan.approvalState !== 'ACTIVE'
      || loan.activationPayment?.status !== 'REPORTED_PENDING_VERIFICATION'
      || !/^\d{12}$/.test(disbursementUtr)) {
      notify('Admin confirmation requires a pending borrower UTR and a 12-digit bank transfer reference.')
      return false
    }
    const installment = buildSchedule(loan)[loan.installmentsPaid || 0]
    if (!installment || Math.abs(installment.installment - loan.activationPayment.amount) > 1) {
      notify('The reported amount does not match the first scheduled installment. Review the repayment schedule.')
      return false
    }
    const principalPortion = Math.min(installment.principal, Math.max(0, loan.principal - loan.paid))
    const interestPortion = Math.max(0, loan.activationPayment.amount - principalPortion)
    const verifiedAt = new Date().toISOString()
    const activationPayment = {
      ...loan.activationPayment,
      status: 'VERIFIED',
      verifiedAt,
      disbursementUtr,
    }
    const patch = {
      approvalState: 'ACTIVE',
      disbursementStage: 'Disbursed',
      activationPayment,
      paid: loan.paid + principalPortion,
      interestPaid: (loan.interestPaid || 0) + interestPortion,
      installmentsPaid: (loan.installmentsPaid || 0) + 1,
      disbursement: {
        ...loan.disbursement,
        mode: 'Direct Bank Transfer',
        utr: disbursementUtr,
        transferredAt: verifiedAt,
        utrStatus: 'Owner recorded after external verification',
      },
    }
    updateOnlineLoan(loanId, patch)
    const receipt = {
      id: `RC-${Date.now().toString().slice(-6)}`,
      loanId,
      borrower: loan.name,
      amount: loan.activationPayment.amount,
      date: verifiedAt,
      mode: 'UPI QR',
      utr: loan.activationPayment.reference,
      principal: principalPortion,
      interest: interestPortion,
      fine: 0,
      digitalSignature: loan.digitalSignature,
    }
    setPaymentHistory((current) => [receipt, ...current])
    notify('Settlement verified and the external disbursement reference was recorded.')
    return true
  }
  useEffect(() => {
    const syncOnlineFlow = (event) => {
      if (event.key !== ONLINE_FLOW_STORAGE_KEY || !event.newValue) return
      try {
        const persisted = JSON.parse(event.newValue)
        if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) return
        const updates = Object.fromEntries(Object.entries(persisted)
          .filter(([id]) => /^LN-[A-Z0-9-]{1,32}$/i.test(id))
          .map(([id, patch]) => [id, sanitizeOnlineFlowPatch(patch)]))
        setLoans((current) => current.map((loan) => updates[loan.id]
          ? { ...loan, ...updates[loan.id] }
          : loan))
        setSelected((current) => current && updates[current.id]
          ? { ...current, ...updates[current.id] }
          : current)
      } catch (error) {
        console.error('Could not sync an online loan workflow update:', error)
        notify('A cross-tab workflow update could not be loaded.')
      }
    }
    window.addEventListener('storage', syncOnlineFlow)
    return () => window.removeEventListener('storage', syncOnlineFlow)
  }, [notify])

  const openPayment = (loan) => {
    setSelected(loan)
    setPayment({ amount: String(installmentDue(loan) + lateFeeFor(loan, lateFee)), mode: isBorrower ? 'UPI QR' : 'Cash', utr: '', kind: 'Full payment' })
    setModal('payment')
  }
  const enableBrowserNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationsPermission('unsupported')
      notify('This browser does not support local notifications.')
      return
    }
    const permission = await Notification.requestPermission()
    setNotificationsPermission(permission)
    if (permission === 'granted') {
      const visibleLoans = role === 'Borrower'
        ? ledgerLoans.filter((loan) => loan.id === sessionIdentity?.loanId)
        : role === 'Agent'
          ? ledgerLoans.filter((loan) => loan.assignedAgent === 'Arjun Kumar')
          : ledgerLoans
      if (!visibleLoans.some((loan) => loan.status === 'Due today' || loan.status.startsWith('Overdue'))) {
        new Notification('LendPro notifications enabled', { body: 'Payment reminders are active while this app is open.' })
      }
    } else {
      notify('Notification permission was not granted.')
    }
  }

  const addPinDigit = (digit) => {
    setPin((current) => current.length < 6 ? `${current}${digit}` : current)
    setPinError('')
  }
  const sendDemoOtp = () => {
    setOtpSent(true)
    setOtp('')
    setPinError('')
  }
  const registerBorrower = (event) => {
    event.preventDefault()
    const phone = normalizeMobile(registration.phone)
    if (registration.name.trim().length < 2 || phone.length !== 10 || !/^\d{4,6}$/.test(registration.pin)) {
      notify('Enter a full name, a valid 10-digit mobile number and a 4- or 6-digit PIN.')
      return
    }
    if (borrowerAccounts.some((account) => normalizeMobile(account.phone) === phone) || loans.some((loan) => normalizeMobile(loan.phone) === phone)) {
      notify('An account already uses this mobile number. Please sign in instead.')
      return
    }
    const account = { ...registration, name: registration.name.trim(), phone, referral: registration.referral.trim() }
    setBorrowerAccounts((current) => [...current, account])
    setLanguage(account.language)
    setLoginRole('Borrower')
    setLoginIdentifier(phone)
    setRegistration({ name: '', pin: '', phone: '', email: '', language: 'EN', referral: '' })
    setRegistering(false)
    setVerificationMode('PIN')
    notify('Your profile is ready. Sign in with your mobile number and PIN to continue KYC.')
  }
  const createBorrowerApplication = (application) => {
    const profile = borrowerAccounts.find((account) => normalizeMobile(account.phone) === normalizeMobile(sessionIdentity?.phone))
      || { name: sessionIdentity?.displayName || borrowerLoan?.name || 'Borrower', phone: sessionIdentity?.phone || borrowerLoan?.phone || '' }
    const id = `LN-${String(Date.now()).slice(-6)}`
    const start = new Date().toISOString().slice(0, 10)
    const loan = {
      id, name: profile.name, phone: profile.phone, email: profile.email || '', type: application.product,
      principal: application.amount, paid: 0, interestPaid: 0, installmentsPaid: 0,
      installment: application.repaymentType === 'Girvi'
        ? Math.round(application.amount * application.rate * frequencyFactor(application.frequency) / 100)
        : calculateInstallment(application.amount, application.rate, application.term, application.frequency, application.interestMethod),
      due: 'Under review', status: 'Under review', approvalState: 'UNDER_REVIEW', risk: application.risk,
      frequency: application.frequency, term: application.term, rate: application.rate,
      interestMethod: application.interestMethod, repaymentType: application.repaymentType,
      maturityDate: application.repaymentType === 'Girvi' ? addFrequency(new Date(), application.frequency, application.term).toISOString().slice(0, 10) : '',
      start, address: 'Address pending', assignedAgent: '', disbursementStage: 'Under review',
      disbursement: { mode: 'Direct Bank Transfer', bankName: application.bankName, accountNumber: application.accountNumber, ifsc: application.ifsc, utr: '' },
      kycFiles: { pan: application.panFile, aadhaar: application.aadhaarFile },
      panNumber: application.panNumber, aadhaarNumber: application.aadhaarNumber,
      employment: 'Salaried', monthlyIncome: application.monthlyIncome,
      collateralValue: application.collateralValue, digitalSignature: application.digitalSignature,
    }
    setLoans((current) => [loan, ...current])
    setSessionIdentity((current) => ({ ...current, loanId: id }))
    persistLoanFlow(id, {
      principal: loan.principal,
      installment: loan.installment,
      approvalState: loan.approvalState,
      sanctionedAmount: null,
      sanctionedRate: null,
      agreementAcceptedAt: '',
      activationPayment: null,
      disbursementStage: loan.disbursementStage,
    })
    notify('Application submitted. Profile processing started.')
    return loan
  }
  const unlockSession = (event) => {
    event.preventDefault()
    const identity = authenticateIdentity(loginRole, loginIdentifier, loans, borrowerAccounts)
    const code = verificationMode === 'PIN' ? pin : otp
    const validCode = verificationMode === 'PIN'
      ? identity?.pin || pinCodes[loginRole]
      : otpSent ? '1234' : ''
    if (!identity || code !== validCode) {
      setPinError('Invalid ID, PIN, or OTP. Access Denied')
      setPin('')
      setOtp('')
      return
    }
    setRole(loginRole)
    setSessionIdentity(identity)
    if (identity.loanId) setLoginIdentifier(identity.loanId)
    setAuthenticated(true)
    setPin('')
    setOtp('')
    setPinError('')
  }
  const lockSession = () => {
    setAuthenticated(false)
    setSessionIdentity(null)
    setLoginRole('Admin')
    setLoginIdentifier('')
    setVerificationMode('PIN')
    setOtpSent(false)
    setPin('')
    setOtp('')
    setPinError('')
    setModal('')
  }
  const saveSecurityPin = (event) => {
    event.preventDefault()
    const activePin = sessionIdentity?.pin || pinCodes[role]
    if (profilePinForm.current !== activePin) {
      notify('Current PIN is incorrect.')
      return
    }
    if (!/^\d{4}(?:\d{2})?$/.test(profilePinForm.next) || profilePinForm.next !== profilePinForm.confirm) {
      notify('New PIN must be 4 or 6 digits and both entries must match.')
      return
    }
    setPinCodes((current) => ({ ...current, [role]: profilePinForm.next }))
    if (isBorrower && sessionIdentity?.phone) {
      const phone = normalizeMobile(sessionIdentity.phone)
      setBorrowerAccounts((current) => current.map((account) => normalizeMobile(account.phone) === phone ? { ...account, pin: profilePinForm.next } : account))
      setSessionIdentity((current) => ({ ...current, pin: profilePinForm.next }))
    }
    setProfilePinForm({ current: '', next: '', confirm: '' })
    setModal('')
    notify('Security PIN updated for this demo session.')
  }
  const resetSecurityPin = () => {
    const defaultPin = { Admin: '1234', Agent: '2233', Borrower: '5566' }[role]
    setPinCodes((current) => ({ ...current, [role]: defaultPin }))
    if (isBorrower && sessionIdentity?.phone) {
      const phone = normalizeMobile(sessionIdentity.phone)
      setBorrowerAccounts((current) => current.map((account) => normalizeMobile(account.phone) === phone ? { ...account, pin: defaultPin } : account))
      setSessionIdentity((current) => ({ ...current, pin: defaultPin }))
    }
    setProfilePinForm({ current: '', next: '', confirm: '' })
    setModal('')
    notify('Demo PIN restored to its preset value.')
  }

  const confirmPayment = (event) => {
    event.preventDefault()
    const amount = Number(payment.amount)
    if (!selected || !Number.isFinite(amount) || amount <= 0) {
      notify('Enter a valid payment amount.')
      return
    }
    if (payment.mode === 'Bank transfer' && !payment.utr.trim()) {
      notify('Enter the bank transfer UTR / reference number.')
      return
    }
    const factor = frequencyFactor(selected.frequency)
    const currentBalance = selected.principal - selected.paid
    const outstandingPenalty = lateFeeFor(selected, lateFee)
    const fine = Math.min(amount, outstandingPenalty)
    const foreclosureInterest = selected.repaymentType === 'Girvi'
      ? Math.round(selected.principal * selected.rate * factor / 100)
      : 0
    const foreclosureTotal = currentBalance + foreclosureInterest + fine
    if (payment.kind === 'Foreclosure' && amount < foreclosureTotal) {
      notify(`Foreclosure requires at least ${money(foreclosureTotal)}.`)
      return
    }
    const paymentBeforeFine = Math.max(0, amount - fine)
    const dueBeforeFine = installmentDue(selected)
    if (selected.repaymentType === 'Girvi' && payment.kind !== 'Foreclosure' && (selected.installmentsPaid || 0) < selected.term - 1 && amount > dueBeforeFine + fine) {
      notify(`For a Girvi loan, principal is due only on the block date. Current payment is capped at ${money(dueBeforeFine + fine)}.`)
      return
    }
    const reducingInterest = selected.repaymentType === 'Girvi'
      ? Math.round(selected.principal * selected.rate * factor / 100)
      : selected.interestMethod === 'Reducing balance · EMI'
      ? currentBalance * selected.rate * factor / 100
      : selected.principal * selected.rate * factor / 100
    const principalPortion = payment.kind === 'Foreclosure'
      ? currentBalance
      : selected.repaymentType === 'Girvi'
        ? (selected.installmentsPaid || 0) >= selected.term - 1 ? Math.min(currentBalance, Math.max(0, paymentBeforeFine - reducingInterest)) : 0
        : Math.min(currentBalance, Math.max(0, paymentBeforeFine - Math.min(paymentBeforeFine, reducingInterest)))
    const interestPortion = payment.kind === 'Foreclosure' ? foreclosureInterest : Math.max(0, Math.min(paymentBeforeFine, reducingInterest))
    const receipt = { id: `RC-${Date.now().toString().slice(-6)}`, loanId: selected.id, borrower: selected.name, amount, date: new Date().toISOString(), mode: payment.mode, utr: payment.utr, principal: principalPortion, interest: interestPortion, fine, digitalSignature: selected.digitalSignature }
    setReceiptBreakdown(receipt)
    setPaymentHistory((current) => [receipt, ...current])
    setLoans((current) => current.map((loan) => {
      if (loan.id !== selected.id) return loan
      const paid = Math.min(loan.principal, loan.paid + principalPortion)
      const installmentSatisfied = payment.kind === 'Foreclosure' || amount >= installmentDue(loan) + outstandingPenalty
      const installmentsPaid = Math.min(loan.term, (loan.installmentsPaid || 0) + (installmentSatisfied ? 1 : 0))
      return {
        ...loan,
        paid,
        installmentsPaid,
        penaltyPaid: installmentSatisfied ? 0 : (loan.penaltyPaid || 0) + fine,
        interestPaid: (loan.interestPaid || 0) + interestPortion,
        status: paid >= loan.principal ? 'Paid off' : 'Upcoming',
        due: paid >= loan.principal ? 'Completed' : 'Next month',
      }
    }))
    setCollectedToday((current) => current + amount)
    if (payment.mode === 'Cash' && isAgent) setAgentCash((current) => current + amount)
    if (payment.mode === 'Cash' && !isAgent) setOwnerCash((current) => current + amount)
    if (isAgent) setAgentCommission((current) => current + amount * .015)
    setModal('receipt')
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.68 }, colors: ['#83f7d2', '#a894ff', '#f8c879'] })
    if (notificationsPermission === 'granted') new Notification('LendPro payment receipt', { body: `Payment of ${money(amount)} recorded. Receipt ${receipt.id}.` })
    notify('Payment recorded successfully.')
  }

  const addLoan = (event) => {
    event.preventDefault()
    if (!newLoan.name.trim() || !newLoan.phone.trim() || Number(newLoan.principal) <= 0) {
      notify('Name, phone and a valid principal amount are required.')
      return
    }
    if (disbursement.mode === 'Direct UPI Transfer' && (!disbursement.upiId.trim() || !disbursement.utr.trim())) {
      notify('Borrower UPI ID and transfer UTR are required.')
      return
    }
    if (disbursement.mode === 'Direct Bank Transfer' && (!disbursement.bankName.trim() || !disbursement.accountNumber.trim() || !disbursement.ifsc.trim() || !disbursement.utr.trim())) {
      notify('Complete the bank details and NEFT/IMPS UTR.')
      return
    }
    const loan = {
      id: `LN-${String(Date.now()).slice(-4)}`, name: newLoan.name, phone: newLoan.phone,
      type: newLoan.type, principal: Number(newLoan.principal), paid: 0,
      installment: newLoan.repaymentType === 'Girvi'
        ? Math.round(Number(newLoan.principal) * Number(newLoan.rate) * frequencyFactor(newLoan.frequency) / 100)
        : calculateInstallment(Number(newLoan.principal), Number(newLoan.rate), Number(newLoan.term), newLoan.frequency, newLoan.interestMethod),
      due: 'Today', status: 'Due today', risk: Number(newLoan.valuation) && Number(newLoan.principal) / Number(newLoan.valuation) > .75 ? 'High risk' : Number(newLoan.valuation) && Number(newLoan.principal) / Number(newLoan.valuation) > .6 ? 'Moderate' : 'Low risk', frequency: newLoan.frequency,
      term: Number(newLoan.term), rate: Number(newLoan.rate), interestMethod: newLoan.interestMethod, repaymentType: newLoan.repaymentType, maturityDate: newLoan.repaymentType === 'Girvi' ? newLoan.maturityDate || addFrequency(new Date(), newLoan.frequency, Number(newLoan.term)).toISOString().slice(0, 10) : '', installmentsPaid: 0, interestPaid: 0, start: new Date().toISOString().slice(0, 10), address: newLoan.address || 'Address pending', alternatePhone: newLoan.alternatePhone, email: newLoan.email, guarantorName: newLoan.guarantorName, guarantorPhone: newLoan.guarantorPhone, collateral: newLoan.collateral, collateralReference: newLoan.collateralReference, collateralValue: Number(newLoan.valuation) || 0, kycFiles: { ...kycFiles },
      disbursement: { ...disbursement }, assignedAgent: newLoan.assignedAgent,
    }
    setLoans((current) => [loan, ...current])
    setSelected(loan)
    setDisbursementReceipt(`DV-${Date.now().toString().slice(-6)}`)
    setDisbursement({ mode: 'Cash in Hand', upiId: '', utr: '', bankName: '', accountNumber: '', ifsc: '' })
    setNewLoan({ name: '', phone: '', alternatePhone: '', email: '', address: '', guarantorName: '', guarantorPhone: '', collateralReference: '', assignedAgent: '', type: 'Personal', principal: '', repaymentType: 'Regular EMI', maturityDate: '', interestMethod: 'Flat rate · Monthly', frequency: 'Monthly', term: '12', rate: '2', collateral: 'Gold ornaments', valuation: '' })
    setKycFiles({ aadhaar: '', pan: '' })
    setModal('schedule')
    notify('Loan created. Review the repayment schedule.')
  }

  const exportPortfolio = (format = 'csv') => {
    const rows = [['Loan ID', 'Borrower', 'Type', 'Disbursed via', 'Disbursement stage', 'UTR', 'Assigned agent', 'Principal', 'Principal collected', 'Interest collected', 'Unpaid penalty', 'Outstanding incl. penalty', 'Status'], ...filteredLoans.map((loan) => [loan.id, loan.name, loan.type, loan.disbursement?.mode || 'Recorded loan', loan.disbursementStage || 'Recorded', loan.disbursement?.utr || '', loan.assignedAgent || 'Unassigned', loan.principal, loan.paid, loan.interestPaid || 0, loan.overduePenalty, Math.max(0, loan.principal - loan.paid) + loan.overduePenalty, loan.status])]
    const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    const excel = format === 'excel'
    const content = excel
      ? `<table>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>`
      : rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([content], { type: excel ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8' }))
    link.download = `lendpro-portfolio.${excel ? 'xls' : 'csv'}`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    notify(`Portfolio ${excel ? 'Excel' : 'CSV'} report exported.`)
  }
  const exportCsv = () => exportPortfolio('csv')
  const exportExcel = () => exportPortfolio('excel')

  const openReminder = (loan, type = 'reminder') => {
    const fine = lateFeeFor(loan, lateFee)
    const text = type === 'receipt'
      ? `Payment of ${money(Number(receiptBreakdown.amount || payment.amount))} received for loan ${loan.id}. Receipt ${receiptBreakdown.id} is ready.${receiptBreakdown.utr ? ` UTR: ${receiptBreakdown.utr}.` : ''} Thank you, ${loan.name}.`
      : loan.status.startsWith('Overdue')
        ? `Hello ${loan.name}, your ${loan.repaymentType === 'Girvi' ? 'monthly interest payment' : 'EMI'} for loan ${loan.id} is overdue. Daily penalty after ${lateFee.grace} grace days: ${money(lateFee.perDay)}. Unpaid penalty: ${money(fine)}. Total due: ${money(installmentDue(loan) + loan.overduePenalty)}.`
        : `Hello ${loan.name}, a friendly reminder that your ${loan.repaymentType === 'Girvi' ? 'monthly interest payment' : 'EMI'} of ${money(installmentDue(loan))} for loan ${loan.id} is due ${loan.status === 'Upcoming' ? 'in 2 days' : loan.due.toLowerCase()}. Please contact us if you need assistance.`
    const digits = loan.phone.replace(/\D/g, '')
    const phone = digits.length === 10 ? `91${digits}` : digits
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const confirmSettlement = () => {
    if (agentCash <= 0) {
      notify('There is no cash balance to hand over.')
      setModal('')
      return
    }
    setSettlements((current) => [{ id: `ST-${Date.now().toString().slice(-6)}`, amount: agentCash, date: new Date().toISOString(), agent: 'Arjun Kumar' }, ...current])
    setAgentCash(0)
    setModal('')
    notify('Cash handover request logged for owner approval.')
  }

  const openPage = (item) => {
    setPage(item)
    setSearch('')
    setFilter('All')
  }

  const dueCount = ledgerLoans.filter((loan) => (loan.status === 'Due today' || loan.status.startsWith('Overdue')) && (!isAgent || loan.assignedAgent === 'Arjun Kumar')).length

  if (!authenticated && registering) return <RegistrationGate
    registration={registration}
    setRegistration={setRegistration}
    onSubmit={registerBorrower}
    onBack={() => setRegistering(false)}
  />

  if (!authenticated) return <LoginGate
    role={loginRole}
    setRole={(nextRole) => {
      setLoginRole(nextRole)
      setLoginIdentifier('')
      setPin('')
      setOtp('')
      setOtpSent(false)
      setPinError('')
    }}
    identifier={loginIdentifier}
    setIdentifier={(value) => { setLoginIdentifier(value); setPin(''); setOtp(''); setOtpSent(false); setPinError('') }}
    mode={verificationMode}
    setMode={(value) => { setVerificationMode(value); setPin(''); setOtp(''); setOtpSent(false); setPinError('') }}
    loans={loans}
    pin={pin}
    setPin={setPin}
    otp={otp}
    setOtp={(value) => { setOtp(value); setPinError('') }}
    otpSent={otpSent}
    sendOtp={sendDemoOtp}
    visible={pinVisible}
    setVisible={setPinVisible}
    error={pinError}
    onSubmit={unlockSession}
    onDigit={addPinDigit}
    onBackspace={() => setPin((current) => current.slice(0, -1))}
    onRegister={() => { setLoginRole('Borrower'); setRegistering(true); setPinError('') }}
  />

  return (
    <div className={`app-shell min-h-screen ${theme} ${isBorrower ? 'borrower-view' : ''}`}>
      {!isBorrower && <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>lendpro<span>OS</span></strong><small>LENDING, MADE CLEAR</small></div>
        </div>
        <div className="workspace-switch"><div className="workspace-avatar">S</div><div><b>Sahay Capital</b><small>Workspace</small></div><ChevronDown size={15} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {(isAgent ? navItems.filter(({ id }) => ['Overview', 'Collections'].includes(id)) : navItems).map(({ id, icon: Icon, count }) => <button key={id} className={`nav-item ${page === id ? 'selected' : ''}`} onClick={() => openPage(id)}><Icon size={18} /><span>{language === 'हि' ? ({ Overview: 'अवलोकन', Loans: 'किस्तें', Collections: 'वसूली', Borrowers: 'ग्राहक', Reports: 'रिपोर्ट' }[id]) : language === 'HI' ? ({ Overview: 'Overview', Loans: 'Kist', Collections: 'Vasooli', Borrowers: 'Grahak', Reports: 'Reports' }[id]) : id}</span>{!isAgent && count && <small>{count}</small>}</button>)}
        </nav>
        {!isAgent && <><div className="nav-label tools-label">MANAGE</div>
        <button className="nav-item" onClick={() => setModal('apiKeys')}><LockKeyhole size={18} /><span>API keys</span></button>
        <button className="nav-item" onClick={() => setModal('settings')}><ShieldCheck size={18} /><span>Risk & compliance</span></button>
        <button className="nav-item" onClick={() => openPage('Reports')}><Activity size={18} /><span>Activity log</span></button></>}
        <div className="sidebar-bottom">
          {!isAgent && <div className="support-card"><div className="support-icon"><CircleHelp size={18} /></div><b>Need a hand?</b><span>Our lending specialists are here for you.</span><button onClick={() => notify('Support team notified. We’ll be in touch shortly.')}>Contact support <ArrowRight size={14} /></button></div>}
          <button className="profile" onClick={() => { setProfilePinForm({ current: '', next: '', confirm: '' }); setModal('profile') }}><div className="profile-avatar">{sessionIdentity?.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><b>{sessionIdentity?.displayName}</b><small>{role === 'Agent' ? 'Field agent' : 'Owner · Admin'}</small></div><MoreHorizontal size={18} /></button>
        </div>
      </aside>}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open menu" onClick={() => notify('Use the workspace menu to navigate')}><Menu size={20} /></button>
          <div className="breadcrumb">{isBorrower ? 'My account' : 'Workspace'} <span>/</span> <b>{isAgent ? 'Field collections' : isBorrower ? 'Borrower portal' : page}</b></div>
          <div className="top-actions">
            <button className="session-chip" onClick={() => { setProfilePinForm({ current: '', next: '', confirm: '' }); setModal('profile') }}><UserRound size={15} /><span>{sessionIdentity?.displayName}</span><i>·</i><span>{role}</span></button>
            <button className="icon-button" aria-label="Lock session" title="Lock session" onClick={lockSession}><LogOut size={17} /></button>
            <button className="language-button" onClick={() => setLanguage(language === 'EN' ? 'हि' : language === 'हि' ? 'HI' : 'EN')}><Languages size={16} /><span>{language}</span><ChevronDown size={13} /></button>
            <button className="icon-button theme-button" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className={`icon-button notification-button ${notificationsPermission === 'granted' ? 'notifications-enabled' : ''}`} aria-label={notificationsPermission === 'granted' ? 'Send local payment notification' : 'Enable browser notifications'} title="Enable browser notifications (while this app is open)" onClick={enableBrowserNotifications}><Bell size={18} /><i /></button>
            <div className="top-avatar">{sessionIdentity?.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
          </div>
        </header>

        <div className="content-wrap">
          {language !== 'EN' && <div className="language-glossary">{language === 'हि' ? 'मूलधन · ब्याज · किस्त · वसूली' : 'Mool-dhan · Byaaj · Kist · Vasooli'}</div>}
          {isBorrower ? (
            <BorrowerWorkspace profile={borrowerProfile} loan={borrowerLoan} payments={paymentHistory.filter((receipt) => receipt.loanId === borrowerLoan?.id)} openPayment={openPayment} openReceipt={(receipt) => { setSelected(borrowerLoan); setReceiptBreakdown(receipt); setPayment({ amount: String(receipt.amount), mode: receipt.mode, utr: receipt.utr || '', kind: 'Full payment' }); setModal('receipt') }} onApply={createBorrowerApplication} onAcceptOffer={acceptOnlineOffer} onSubmitActivationPayment={submitOnlineActivationPayment} vpa={lateFee.vpa} notify={notify} language={language} creditHistory={borrowerHistory} />
          ) : isAgent ? (
            <AgentDashboard loans={ledgerLoans.filter((loan) => loan.assignedAgent === 'Arjun Kumar')} search={search} setSearch={setSearch} openPayment={openPayment} openReminder={openReminder} notify={notify} lateFee={lateFee} collectedToday={collectedToday} agentCash={agentCash} agentCommission={agentCommission} setModal={setModal} settlements={settlements} />
          ) : page === 'Overview' ? (
            <Overview loans={ledgerLoans} outstanding={outstanding} activeLoans={activeLoans} openPage={openPage} exportCsv={exportCsv} exportExcel={exportExcel} setModal={setModal} openPayment={openPayment} openReminder={openReminder} agentCash={agentCash} ownerCash={ownerCash} settlements={settlements} />
          ) : page === 'Reports' ? (
            <Reports loans={ledgerLoans} exportCsv={exportCsv} exportExcel={exportExcel} />
          ) : (
            <LoanDirectory loans={filteredLoans} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} openPayment={openPayment} openReminder={openReminder} setSelected={setSelected} setModal={setModal} exportCsv={exportCsv} exportExcel={exportExcel} title={page} />
          )}
        </div>
      </main>

      {modal === 'apiKeys' && role === 'Admin' && <ApiKeyManager onClose={() => setModal('')} />}
      {modal === 'newLoan' && <Modal title="Create a new loan" eyebrow="LOAN ORIGINATION" onClose={() => setModal('')} wide><form onSubmit={addLoan} className="loan-form">
        <div className="form-section-title"><span>01</span><div><b>Borrower details</b><small>Start with the basics. You can add KYC documents later.</small></div></div>
        <div className="form-grid"><label>Full name<input value={newLoan.name} onChange={(e) => setNewLoan({ ...newLoan, name: e.target.value })} placeholder="e.g. Aditi Mehra" required /></label><label>Primary mobile<input type="tel" value={newLoan.phone} onChange={(e) => setNewLoan({ ...newLoan, phone: e.target.value })} placeholder="+91 98765 43210" required /></label><label>Email address<input type="email" value={newLoan.email} onChange={(e) => setNewLoan({ ...newLoan, email: e.target.value })} placeholder="borrower@email.com" /></label><label>Alternate mobile<input type="tel" value={newLoan.alternatePhone} onChange={(e) => setNewLoan({ ...newLoan, alternatePhone: e.target.value })} placeholder="+91 98765 43210" /></label><label className="full-field">Full address<input value={newLoan.address} onChange={(e) => setNewLoan({ ...newLoan, address: e.target.value })} placeholder="House, street, city, state and PIN" /></label><label>Guarantor / Jamandar name<input value={newLoan.guarantorName} onChange={(e) => setNewLoan({ ...newLoan, guarantorName: e.target.value })} placeholder="Full name" /></label><label>Guarantor phone<input type="tel" value={newLoan.guarantorPhone} onChange={(e) => setNewLoan({ ...newLoan, guarantorPhone: e.target.value })} placeholder="+91 98765 43210" /></label></div>
        <div className="upload-row"><label className="upload-card"><FileText size={17} /><span><b>Aadhaar card</b><small>{kycFiles.aadhaar || 'Upload a clear image or PDF'}</small></span><Plus size={16} /><input type="file" accept="image/*,.pdf" onChange={(event) => setKycFiles({ ...kycFiles, aadhaar: event.target.files?.[0]?.name || '' })} /></label><label className="upload-card"><FileText size={17} /><span><b>PAN card</b><small>{kycFiles.pan || 'Upload a clear image or PDF'}</small></span><Plus size={16} /><input type="file" accept="image/*,.pdf" onChange={(event) => setKycFiles({ ...kycFiles, pan: event.target.files?.[0]?.name || '' })} /></label></div>
        <div className="form-section-title"><span>02</span><div><b>Loan configuration</b><small>Choose terms that work for your borrower.</small></div></div>
        <div className="form-grid"><label>Loan type<select value={newLoan.type} onChange={(e) => setNewLoan({ ...newLoan, type: e.target.value })}><option>Personal</option><option>Business</option><option>Gold loan</option><option>Vehicle</option></select></label><label>Principal amount (₹)<input type="number" min="1" value={newLoan.principal} onChange={(e) => setNewLoan({ ...newLoan, principal: e.target.value })} placeholder="₹ 0" required /></label><label>Interest method<select value={newLoan.interestMethod} onChange={(e) => setNewLoan({ ...newLoan, interestMethod: e.target.value })}><option>Flat rate · Monthly</option><option>Reducing balance · EMI</option></select></label><label>Rate (% per month)<input type="number" min="0" step="0.1" value={newLoan.rate} onChange={(e) => setNewLoan({ ...newLoan, rate: e.target.value })} /></label><label>Repayment frequency<select value={newLoan.frequency} onChange={(e) => setNewLoan({ ...newLoan, frequency: e.target.value })}><option>Monthly</option><option>Weekly</option><option>Daily</option><option>Yearly</option></select></label><label>Tenure (installments)<input type="number" min="1" value={newLoan.term} onChange={(e) => setNewLoan({ ...newLoan, term: e.target.value })} /></label></div>
        <div className="repayment-choice"><label>Repayment plan<select value={newLoan.repaymentType} onChange={(e) => setNewLoan({ ...newLoan, repaymentType: e.target.value })}><option>Regular EMI</option><option>Girvi</option></select></label><p>{newLoan.repaymentType === 'Girvi' ? 'Monthly interest-only payments; the original principal is due in full on the maturity / block date.' : 'Each installment includes principal and interest, reducing the outstanding principal over the loan term.'}</p>{newLoan.repaymentType === 'Girvi' && <label>Principal block / maturity date<input type="date" value={newLoan.maturityDate} onChange={(e) => setNewLoan({ ...newLoan, maturityDate: e.target.value })} /></label>}</div>
        <div className="collateral-box"><div className="collateral-heading"><ShieldCheck size={18} /><div><b>Collateral & risk check</b><small>Optional security for this loan</small></div><span className={`risk-pill ${Number(newLoan.valuation) && Number(newLoan.principal) / Number(newLoan.valuation) > .75 ? 'high' : Number(newLoan.valuation) && Number(newLoan.principal) / Number(newLoan.valuation) > .6 ? 'medium' : 'low'}`}>{Number(newLoan.valuation) && Number(newLoan.principal) / Number(newLoan.valuation) > .75 ? 'HIGH RISK' : Number(newLoan.valuation) && Number(newLoan.principal) / Number(newLoan.valuation) > .6 ? 'MODERATE' : 'LOW RISK'}</span></div><div className="form-grid"><label>Collateral type<select value={newLoan.collateral} onChange={(e) => setNewLoan({ ...newLoan, collateral: e.target.value })}><option>Gold ornaments</option><option>Vehicle RC</option><option>Property deeds</option><option>Security cheque</option><option>None</option></select></label><label>Estimated collateral value (₹)<input type="number" min="0" value={newLoan.valuation} onChange={(e) => setNewLoan({ ...newLoan, valuation: e.target.value })} placeholder="Optional" /></label>{newLoan.collateral !== 'None' && <label className="full-field">{newLoan.collateral === 'Gold ornaments' ? 'Weight / description' : newLoan.collateral === 'Security cheque' ? 'Cheque number' : 'Collateral reference'}<input value={newLoan.collateralReference} onChange={(e) => setNewLoan({ ...newLoan, collateralReference: e.target.value })} placeholder={newLoan.collateral === 'Gold ornaments' ? 'e.g. 24g · 22K chain' : 'Enter reference details'} /></label>}</div>{newLoan.valuation && newLoan.principal && <div className="ltv-inline"><span>LTV ratio</span><b>{Math.round(Number(newLoan.principal) / Number(newLoan.valuation) * 100)}%</b><div className="ltv-track"><i style={{ width: `${Math.min(100, Number(newLoan.principal) / Number(newLoan.valuation) * 100)}%` }} /></div><small>{Number(newLoan.principal) / Number(newLoan.valuation) > .75 ? 'Above recommended 75% threshold' : Number(newLoan.principal) / Number(newLoan.valuation) > .6 ? 'Moderate collateral coverage' : 'Within recommended range'}</small></div>}</div>
        <div className="form-section-title"><span>03</span><div><b>Disbursement details</b><small>Record how the sanctioned amount will reach the borrower.</small></div></div>
        <label>Assign field agent<select value={newLoan.assignedAgent} onChange={(event) => setNewLoan({ ...newLoan, assignedAgent: event.target.value })}><option value="">Unassigned</option><option value="Arjun Kumar">Arjun Kumar · Field agent</option></select></label>
        <div className="form-grid"><label className="full-field">Disbursement mode<select value={disbursement.mode} onChange={(event) => setDisbursement({ ...disbursement, mode: event.target.value })}><option>Cash in Hand</option><option>Direct UPI Transfer</option><option>Direct Bank Transfer</option></select></label>{disbursement.mode === 'Direct UPI Transfer' && <><label>Borrower UPI ID<input value={disbursement.upiId} onChange={(event) => setDisbursement({ ...disbursement, upiId: event.target.value })} placeholder="borrower@upi" required /></label><label>UPI transfer UTR<input value={disbursement.utr} onChange={(event) => setDisbursement({ ...disbursement, utr: event.target.value })} placeholder="12-digit reference" required /></label></>}{disbursement.mode === 'Direct Bank Transfer' && <><label>Bank name<input value={disbursement.bankName} onChange={(event) => setDisbursement({ ...disbursement, bankName: event.target.value })} placeholder="Bank name" required /></label><label>Account number<input value={disbursement.accountNumber} onChange={(event) => setDisbursement({ ...disbursement, accountNumber: event.target.value })} placeholder="Account number" required /></label><label>IFSC code<input value={disbursement.ifsc} onChange={(event) => setDisbursement({ ...disbursement, ifsc: event.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" required /></label><label>NEFT / IMPS UTR<input value={disbursement.utr} onChange={(event) => setDisbursement({ ...disbursement, utr: event.target.value })} placeholder="Transfer reference" required /></label></>}</div>
        <div className="form-footer"><span><ShieldCheck size={14} /> Your borrower data stays protected</span><button className="primary-button" type="submit">Review loan schedule <ArrowRight size={16} /></button></div>
      </form></Modal>}

      {modal === 'payment' && selected && <Modal title="Record a collection" eyebrow={`PAYMENT · ${selected.id}`} onClose={() => setModal('')}><form className="payment-form" onSubmit={confirmPayment}>
        <div className="borrower-summary"><div className="borrower-avatar">{selected.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><b>{selected.name}</b><small>{selected.type} loan · {selected.id}</small></div><span className={`risk-pill ${selected.risk === 'High risk' ? 'high' : selected.risk === 'Moderate' ? 'medium' : 'low'}`}>{selected.risk}</span></div>
        <div className="payment-kind">{['Full payment', 'Partial', 'Foreclosure'].map((kind) => <button type="button" className={payment.kind === kind ? 'active' : ''} key={kind} onClick={() => setPayment({ ...payment, kind, amount: kind === 'Full payment' ? String(installmentDue(selected) + lateFeeFor(selected, lateFee)) : kind === 'Foreclosure' ? String(foreclosureDue(selected, lateFee)) : '' })}>{kind}</button>)}</div>
        {selected.repaymentType === 'Girvi' && <div className="girvi-payment-note"><b>Girvi · interest-only schedule</b><span>{(selected.installmentsPaid || 0) >= selected.term - 1 ? 'Maturity installment includes monthly interest and the full remaining principal.' : `Monthly interest due: ${money(installmentDue(selected))}. Principal of ${money(selected.principal - selected.paid)} is due on ${selected.maturityDate ? new Date(`${selected.maturityDate}T00:00:00`).toLocaleDateString('en-IN') : 'the block date'}.`}</span></div>}
        <label>Amount collected<input autoFocus type="number" min="1" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} required /></label>
        <div className="payment-modes">{['Cash', 'Bank transfer', 'UPI QR'].map((mode) => <button type="button" key={mode} className={payment.mode === mode ? 'active' : ''} onClick={() => setPayment({ ...payment, mode })}>{mode === 'Cash' ? <Banknote size={16} /> : mode === 'Bank transfer' ? <Landmark size={16} /> : <IndianRupee size={16} />}{mode}</button>)}</div>
        {payment.mode === 'Bank transfer' && <label>UTR / transaction reference<input value={payment.utr} onChange={(e) => setPayment({ ...payment, utr: e.target.value })} placeholder="e.g. 426512849302" /></label>}
        {payment.mode === 'UPI QR' && <div className="qr-panel"><QRCodeSVG value={`upi://pay?pa=${encodeURIComponent(lateFee.vpa)}&pn=LendPro&am=${Number(payment.amount) || 0}&tn=${encodeURIComponent(selected.id)}`} title={`upi://pay?pa=${lateFee.vpa}&pn=LendPro&am=${Number(payment.amount) || 0}&tn=${selected.id}`} size={138} bgColor="#ffffff" fgColor="#111827" level="M" /><span>Scan to pay <b>{money(Number(payment.amount))}</b></span><small>{lateFee.vpa} · {selected.id}</small><small>Works with PhonePe, Google Pay & Paytm</small></div>}
        <div className="fee-line"><span>Grace period</span><b>{lateFee.grace} days</b></div><div className="fee-line"><span>Daily penalty</span><b>{money(lateFee.perDay)} / day</b></div><div className="fee-line"><span>Accrued unpaid penalty</span><b className={selected.overduePenalty ? 'penalty-amount' : ''}>{money(selected.overduePenalty || 0)}</b></div>
        <button className="primary-button full-button" type="submit">Confirm collection <ArrowRight size={16} /></button>
      </form></Modal>}

      {modal === 'receipt' && selected && <Modal title="Payment received" eyebrow="COLLECTION SUCCESSFUL" onClose={() => setModal('')}><div className="receipt" id="receipt-print"><div className="receipt-logo"><div className="brand-mark"><span /><span /><span /></div><b>lendpro<span>OS</span></b></div><div className="receipt-success"><CheckCircle2 size={27} /><b>{money(Number(payment.amount))}</b><span>Payment recorded successfully</span></div><div className="receipt-meta"><span>Receipt number</span><b>{receiptBreakdown.id}</b><span>Date & time</span><b>{new Date(receiptBreakdown.date).toLocaleString('en-IN')}</b><span>Loan ID</span><b>{selected.id}</b><span>Borrower</span><b>{selected.name}</b><span>Payment mode</span><b>{payment.mode}{payment.utr ? ` · ${payment.utr}` : ''}</b><span>Principal component</span><b>{money(receiptBreakdown.principal)}</b><span>Interest component</span><b>{money(receiptBreakdown.interest)}</b><span>Late fee</span><b>{money(receiptBreakdown.fine)}</b><span>Amount received</span><b>{money(Number(payment.amount))}</b></div><div className="receipt-signature"><span>Authorized signature</span><span>Borrower signature{receiptBreakdown.digitalSignature ? <img src={receiptBreakdown.digitalSignature} alt="Borrower digital signature" /> : <small>No digital signature on file</small>}</span></div></div><div className="receipt-actions"><button className="secondary-button" onClick={() => window.print()}><Download size={15} /> Print / save PDF</button><button className="primary-button" onClick={() => openReminder(selected, 'receipt')}>Send on WhatsApp <ArrowRight size={15} /></button></div></Modal>}

      {modal === 'schedule' && selected && <Modal title="Repayment schedule" eyebrow={`SCHEDULE PREVIEW · ${selected.id}`} onClose={() => setModal('')} wide>
        <div className="schedule-head">
          <div><span>Principal</span><b>{money(selected.principal)}</b></div>
          <div><span>{selected.repaymentType === 'Girvi' ? 'Monthly interest' : 'Installment'}</span><b>{money(selected.installment)}</b></div>
          <div><span>Tenure</span><b>{selected.term} {selected.frequency.toLowerCase()} installments</b></div>
          <div><span>Repayment plan</span><b>{selected.repaymentType || 'Regular EMI'}</b></div>
        </div>
        {selected.repaymentType === 'Girvi' && <div className="girvi-payment-note"><b>Girvi · principal block date {selected.maturityDate ? new Date(`${selected.maturityDate}T00:00:00`).toLocaleDateString('en-IN') : 'at maturity'}</b><span>Monthly installments are interest-only; the final installment includes the remaining principal plus interest.</span></div>}
        {selected.disbursement && <div className="disbursement-voucher" id="disbursement-voucher"><div><div className="section-kicker">DISBURSEMENT VOUCHER · {disbursementReceipt}</div><b>{money(selected.principal)} disbursed to {selected.name}</b><span>{selected.disbursement.mode}{selected.disbursement.utr ? ` · UTR ${selected.disbursement.utr}` : ''}</span>{selected.disbursement.mode === 'Cash in Hand' && <span>Cash voucher · Borrower acknowledgement required</span>}{selected.disbursement.mode === 'Direct UPI Transfer' && <span>{selected.disbursement.upiId}</span>}{selected.disbursement.mode === 'Direct Bank Transfer' && <span>{selected.disbursement.bankName} · A/C ending {selected.disbursement.accountNumber.slice(-4)} · {selected.disbursement.ifsc}</span>}{selected.digitalSignature && <span className="voucher-signature">Borrower e-signature<img src={selected.digitalSignature} alt="Borrower digital signature" /></span>}</div><button className="secondary-button" onClick={() => window.print()}><Download size={14} /> Print voucher</button></div>}
        <div className="table-scroll schedule-scroll"><table><thead><tr><th>#</th><th>Due date</th><th>Principal</th><th>Interest</th><th>Installment</th><th>Status</th></tr></thead><tbody>{buildSchedule(selected).map((row) => <tr key={row.number}><td>{String(row.number).padStart(2, '0')}</td><td>{row.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td>{money(row.principal)}</td><td>{money(row.interest)}</td><td><b>{money(row.installment)}</b></td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div>
        <p className="schedule-note">Showing all {selected.term} installment{selected.term === 1 ? '' : 's'}. {selected.repaymentType === 'Girvi' ? 'Principal stays unchanged until maturity.' : 'Flat-rate and reducing-balance interest are calculated by installment frequency.'}</p>
        <button className="primary-button full-button" onClick={() => { setModal(''); setPage('Loans') }}>Done <Check size={16} /></button>
      </Modal>}
      {modal === 'settlement' && <Modal title="Handover cash to owner" eyebrow="CASH SETTLEMENT REQUEST" onClose={() => setModal('')}><div className="settlement-confirm"><div className="settlement-amount"><Wallet size={21} /><span>Cash to hand over</span><b>{money(agentCash)}</b></div><p>This logs a handover request for Saanvi Patel. Your field cash balance will reset after submitting the request.</p><button className="primary-button full-button" disabled={!agentCash} onClick={confirmSettlement}>Submit handover request <ArrowRight size={15} /></button></div></Modal>}
      {modal === 'profile' && <Modal title="Profile & security" eyebrow="SESSION SETTINGS" onClose={() => setModal('')}><div className="security-profile"><div className="security-profile-icon"><LockKeyhole size={19} /></div><div><b>{isAgent ? 'Arjun Kumar' : isBorrower ? borrowerProfile.name : 'Saanvi Patel'}</b><small>{role} session · demo PIN authentication</small></div></div><form className="settings-panel" onSubmit={saveSecurityPin}><label>Current PIN<input inputMode="numeric" maxLength="6" type="password" value={profilePinForm.current} onChange={(event) => setProfilePinForm({ ...profilePinForm, current: event.target.value.replace(/\D/g, '').slice(0, 6) })} required /></label><label>New 4- or 6-digit PIN<input inputMode="numeric" maxLength="6" type="password" value={profilePinForm.next} onChange={(event) => setProfilePinForm({ ...profilePinForm, next: event.target.value.replace(/\D/g, '').slice(0, 6) })} required /></label><label>Confirm new PIN<input inputMode="numeric" maxLength="6" type="password" value={profilePinForm.confirm} onChange={(event) => setProfilePinForm({ ...profilePinForm, confirm: event.target.value.replace(/\D/g, '').slice(0, 6) })} required /></label><p className="demo-security-note">Demo only: PINs are held in browser memory and are not server-verified. Reset restores the role’s preset demo PIN.</p><button className="primary-button full-button" type="submit">Update security PIN <Check size={16} /></button><button className="secondary-button full-button" type="button" onClick={() => { if (window.confirm('Restore this profile to its preset demo PIN?')) resetSecurityPin() }}>Reset to preset demo PIN</button></form></Modal>}
      {modal === 'settings' && <Modal title="Risk & compliance" eyebrow="WORKSPACE SETTINGS" onClose={() => setModal('')}><div className="settings-panel"><label>Grace period (days)<input type="number" value={lateFee.grace} min="0" onChange={(event) => setLateFee({ ...lateFee, grace: Number(event.target.value) })} /></label><label>Late fee per day (₹)<input type="number" value={lateFee.perDay} min="0" onChange={(event) => setLateFee({ ...lateFee, perDay: Number(event.target.value) })} /></label><label>Lender UPI ID<input value={lateFee.vpa} onChange={(event) => setLateFee({ ...lateFee, vpa: event.target.value })} /></label><button className="primary-button full-button" onClick={() => { setModal(''); notify('Settings saved successfully.') }}>Save settings <Check size={16} /></button></div></Modal>}
      {modal === 'details' && selected && <Modal title={selected.name} eyebrow={`BORROWER PROFILE · ${selected.id}`} onClose={() => setModal('')} wide><div className="borrower-summary detail-summary"><div className="borrower-avatar">{selected.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><b>{selected.type} loan</b><small>{selected.phone} · {selected.address}</small></div><RiskBadge risk={selected.risk} /></div><div className="detail-grid"><div><span>Principal</span><b>{money(selected.principal)}</b></div><div><span>Principal collected</span><b>{money(selected.paid)}</b></div><div><span>Outstanding</span><b>{money(Math.max(0, selected.principal - selected.paid))}</b></div><div><span>Installment</span><b>{money(selected.installment)}</b></div><div><span>Interest rate</span><b>{selected.rate}% / month</b></div><div><span>Repayment</span><b>{selected.frequency} · {selected.term} installments</b></div><div><span>Guarantor</span><b>{selected.guarantorName || 'Not recorded'}</b></div><div><span>Collateral</span><b>{selected.collateral || 'Not recorded'}{selected.collateralValue ? ` · ${money(selected.collateralValue)}` : ''}</b></div><div><span>Aadhaar KYC</span><b>{selected.kycFiles?.aadhaar || 'Not attached'}</b></div><div><span>PAN KYC</span><b>{selected.kycFiles?.pan || 'Not attached'}</b></div></div>{role === 'Admin' && selected.approvalState === 'UNDER_REVIEW' && <LoanApprovalPanel loan={selected} onApprove={sanctionOnlineLoan} />}{selected.activationPayment && <div className={`activation-review-note ${selected.activationPayment.status === 'VERIFIED' ? 'verified' : ''}`}><AlertTriangle size={16} /><span>Borrower UPI reference <b>{selected.activationPayment.reference}</b> · {selected.activationPayment.status === 'REPORTED_PENDING_VERIFICATION' ? 'awaiting independent settlement verification; do not treat as funds received.' : `verified ${new Date(selected.activationPayment.verifiedAt).toLocaleString('en-IN')} · bank disbursement reference ${selected.activationPayment.disbursementUtr}`}</span></div>}{role === 'Admin' && selected.activationPayment?.status === 'REPORTED_PENDING_VERIFICATION' && <LoanDisbursementPanel loan={selected} onConfirm={confirmOnlineDisbursement} />}<div className="detail-actions"><button className="secondary-button" onClick={() => setModal('schedule')}><CalendarDays size={14} /> Repayment schedule</button><button className="secondary-button" onClick={() => openReminder(selected)}><ArrowRight size={14} /> WhatsApp</button><button className="primary-button" onClick={() => openPayment(selected)} disabled={!isCapitalizedLoan(selected)}><Check size={14} /> {isCapitalizedLoan(selected) ? 'Record payment' : 'Not yet disbursed'}</button></div></Modal>}

      {!isBorrower && <WorkspaceAssistant role={role} dueCount={dueCount} cash={agentCash} commission={agentCommission} vpa={lateFee.vpa} />}
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  )
}

function LoginGate({ role, setRole, identifier, setIdentifier, mode, setMode, pin, setPin, otp, setOtp, otpSent, sendOtp, visible, setVisible, error, onSubmit, onDigit, onBackspace, onRegister }) {
  const roleDetails = {
    Admin: { title: 'Owner / Admin', placeholder: 'Registered mobile or Admin ID', sample: 'Demo ID: AD-01', pin: '1234' },
    Agent: { title: 'Field Agent', placeholder: 'Staff mobile or Agent code', sample: 'Demo ID: AG-01', pin: '2233' },
    Borrower: { title: 'Borrower / Client', placeholder: 'Registered mobile or Loan ID', sample: 'Demo ID: LN-2408', pin: '5566' },
  }[role]
  const canSubmit = identifier.trim().length > 0 && (mode === 'PIN' ? [4, 6].includes(pin.length) : otpSent && otp.length === 4)
  return <main className="login-gate">
    <section className="login-card">
      <div className="login-brand"><div className="brand-mark"><span /><span /><span /></div><div><strong>lendpro<span>OS</span></strong><small>LENDING, MADE CLEAR</small></div></div>
      <div className="login-heading"><div className="login-lock"><LockKeyhole size={20} /></div><div className="eyebrow">SECURE ACCESS</div><h1>Welcome back</h1><p>Verify your identity to continue securely.</p></div>
      <div className="login-role-tabs" role="tablist" aria-label="Choose account type">
        {['Admin', 'Agent', 'Borrower'].map((item) => <button type="button" role="tab" aria-selected={role === item} className={role === item ? 'active' : ''} key={item} onClick={() => setRole(item)}>{item === 'Admin' ? 'Owner / Admin' : item === 'Agent' ? 'Field Agent' : 'Borrower / Client'}</button>)}
      </div>
      <form onSubmit={onSubmit}>
        <div className="login-step-label"><span>01</span><b>Identify your account</b></div>
        <label className="login-identifier-label" htmlFor="login-identifier">Personal ID / Registered mobile number</label>
        <input id="login-identifier" className="login-identifier-input" type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={roleDetails.placeholder} autoComplete="off" autoCapitalize="characters" spellCheck="false" aria-label="Personal ID or registered mobile number" />
        <div className="login-identifier-hint">{roleDetails.sample} <span>·</span> No account directory is shown</div>
        <div className="login-step-label login-verify-step"><span>02</span><b>Choose verification method</b></div>
        <div className="login-mode-tabs" role="tablist" aria-label="Verification method">
          <button type="button" role="tab" aria-selected={mode === 'PIN'} className={mode === 'PIN' ? 'active' : ''} onClick={() => setMode('PIN')}><LockKeyhole size={14} /> Security PIN</button>
          <button type="button" role="tab" aria-selected={mode === 'OTP'} className={mode === 'OTP' ? 'active' : ''} onClick={() => setMode('OTP')}><ShieldCheck size={14} /> SMS / WhatsApp OTP</button>
        </div>
        {mode === 'PIN' ? <>
          <div className="pin-label-row"><label htmlFor="mpin-display">Enter your 4- or 6-digit security PIN</label><button type="button" className="pin-visibility" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide PIN' : 'Reveal PIN'}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}{visible ? 'Hide' : 'Reveal'}</button></div>
          <input id="mpin-display" className="pin-display" inputMode="none" readOnly value={visible ? pin : '•'.repeat(pin.length)} placeholder="○  ○  ○  ○" aria-label="PIN digits" />
          <div className="pin-pad">{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((key) => <button type="button" key={key} aria-label={key === 'clear' ? 'Clear PIN' : key === 'back' ? 'Delete last PIN digit' : `Enter ${key}`} onClick={() => key === 'clear' ? setPin('') : key === 'back' ? onBackspace() : onDigit(key)}>{key === 'clear' ? 'Clear' : key === 'back' ? '⌫' : key}</button>)}</div>
        </> : <div className="otp-panel">
          <button className="secondary-button otp-send-button" type="button" onClick={sendOtp}><ShieldCheck size={15} /> {otpSent ? 'Resend 4-digit OTP' : 'Send 4-digit OTP'}</button>
          {otpSent && <div className="otp-dispatch-note" role="status" aria-live="polite"><CheckCircle2 size={15} /><span>Demo OTP dispatched by SMS / WhatsApp: <b>1234</b></span></div>}
          <label className="otp-input-label" htmlFor="otp-code">Enter the 4-digit OTP</label>
          <input id="otp-code" className="pin-display otp-display" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength="4" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="○  ○  ○  ○" disabled={!otpSent} autoFocus={otpSent} />
        </div>}
        {error && <div className="pin-error" role="alert">{error}</div>}
        <button className="primary-button full-button login-submit" type="submit" disabled={!canSubmit}><LockKeyhole size={15} /> Verify &amp; unlock <ArrowRight size={15} /></button>
      </form>
      <div className="demo-pin-hint"><b>{mode === 'PIN' ? `Demo ${roleDetails.title} PIN` : 'Demo OTP'}</b><span><code>{mode === 'PIN' ? roleDetails.pin : '1234'}</code> · {roleDetails.sample}</span></div>
      {role === 'Borrower' && <button className="register-link" type="button" onClick={onRegister}>New to LendPro? <b>Create your client profile</b><ArrowRight size={14} /></button>}
      <p className="login-demo-notice">Demo authentication only. Production access control must be enforced by a secure backend.</p>
    </section>
    <div className="login-decoration login-decoration-one" /><div className="login-decoration login-decoration-two" />
  </main>
}

function RegistrationGate({ registration, setRegistration, onSubmit, onBack }) {
  const update = (field) => (event) => setRegistration((current) => ({ ...current, [field]: event.target.value }))
  return <main className="login-gate registration-gate">
    <section className="login-card registration-card">
      <div className="login-brand"><div className="brand-mark"><span /><span /><span /></div><div><strong>lendpro<span>OS</span></strong><small>YOUR BORROWER PORTAL</small></div></div>
      <div className="login-heading"><div className="eyebrow">CLIENT REGISTRATION</div><h1>Your next step, made simple.</h1><p>Create a secure profile to check eligibility and track your application.</p></div>
      <form className="registration-form" onSubmit={onSubmit}>
        <label>Full name<input value={registration.name} onChange={update('name')} autoComplete="name" placeholder="As shown on your ID" required /></label>
        <label>Primary phone number<input type="tel" inputMode="tel" value={registration.phone} onChange={update('phone')} autoComplete="tel" placeholder="+91 98765 43210" minLength="10" required /></label>
        <label>Email address<input type="email" value={registration.email} onChange={update('email')} autoComplete="email" placeholder="you@example.com" /></label>
        <label>Security PIN <span className="field-note">4 or 6 digits</span><input type="password" inputMode="numeric" pattern="[0-9]{4}|[0-9]{6}" maxLength="6" value={registration.pin} onChange={(event) => setRegistration((current) => ({ ...current, pin: event.target.value.replace(/\D/g, '').slice(0, 6) }))} autoComplete="new-password" placeholder="Create your PIN" required /></label>
        <label>Interface language<select value={registration.language} onChange={update('language')}><option value="EN">English</option><option value="हि">हिन्दी</option><option value="HI">Hinglish</option></select></label>
        <div className="referral-card"><div><b>Have a referral code?</b><small>Add it now or skip this step. Eligible bonuses appear after verification.</small></div><input value={registration.referral} onChange={update('referral')} placeholder="Enter code · optional" /></div>
        <button className="primary-button full-button" type="submit">Create secure profile <ArrowRight size={16} /></button>
      </form>
      <button className="register-link" type="button" onClick={onBack}>Already have an account? <b>Back to sign in</b></button>
      <p className="login-demo-notice">Demo experience: profile data stays in browser memory and is not sent to a lender.</p>
    </section>
  </main>
}

function BorrowerWorkspace({ profile, loan, payments, openPayment, openReceipt, onApply, onAcceptOffer, onSubmitActivationPayment, vpa, notify, language, creditHistory }) {
  return <div className="borrower-workspace">
    {loan && <BorrowerPortal loan={loan} payments={payments} openPayment={openPayment} openReceipt={openReceipt} />}
    <BorrowerJourney key={profile.phone} profile={profile} activeLoan={loan} onApply={onApply} onAcceptOffer={onAcceptOffer} onSubmitActivationPayment={onSubmitActivationPayment} vpa={vpa} notify={notify} language={language} creditHistory={creditHistory} />
  </div>
}

function LoanApprovalPanel({ loan, onApprove }) {
  const [amount, setAmount] = useState(String(loan.principal))
  const [rate, setRate] = useState(String(loan.rate))
  const monthlyInterest = Math.round((Number(amount) || 0) * (Number(rate) || 0) / 100)
  const modified = Number(amount) !== loan.principal || Number(rate) !== loan.rate
  const submit = (event) => {
    event.preventDefault()
    onApprove(loan.id, amount, rate)
  }
  return <form className="loan-approval-panel" onSubmit={submit}>
    <div><span className="section-kicker">ADMIN UNDERWRITING</span><h3>Review and sanction offer</h3><p>Borrower access unlocks only after this explicit approval.</p></div>
    <div className="loan-approval-fields"><label>Sanction amount (₹)<input type="number" min="1" max={loan.principal} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label>Monthly interest rate (%)<input type="number" min="0" max="100" step="0.01" value={rate} onChange={(event) => setRate(event.target.value)} required /></label></div>
    <p className="loan-approval-interest">Indicative monthly byaaj: <b>{money(monthlyInterest)}</b></p>
    <button className="primary-button">{modified ? 'Sanction modified offer' : 'Approve & send offer'} <ArrowRight size={14} /></button>
  </form>
}

function LoanDisbursementPanel({ loan, onConfirm }) {
  const [disbursementUtr, setDisbursementUtr] = useState('')
  const [externallyVerified, setExternallyVerified] = useState(false)
  const submit = (event) => {
    event.preventDefault()
    onConfirm(loan.id, disbursementUtr)
  }
  return <form className="loan-disbursement-panel" onSubmit={submit}>
    <div><span className="section-kicker">ADMIN SETTLEMENT CHECK</span><h3>Verify payment and record disbursement</h3><p>Match the borrower's UPI reference against your bank statement, then complete the transfer outside this demo.</p></div>
    <label>Bank disbursement UTR (12 digits)<input value={disbursementUtr} onChange={(event) => setDisbursementUtr(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" minLength="12" maxLength="12" pattern="[0-9]{12}" placeholder="12-digit bank transfer reference" required /></label>
    <label className="disbursement-attestation"><input type="checkbox" checked={externallyVerified} onChange={(event) => setExternallyVerified(event.target.checked)} required /><span>I independently verified the borrower's UPI settlement and completed the bank disbursement outside LendPro.</span></label>
    <button className="primary-button" disabled={!externallyVerified || disbursementUtr.length !== 12}>Verify settlement & record disbursement <Check size={14} /></button>
  </form>
}

function BorrowerJourney({ profile, activeLoan, onApply, onAcceptOffer, onSubmitActivationPayment, vpa, notify, language, creditHistory }) {
  const [kyc, setKyc] = useState({ pan: '', panFile: '', aadhaar: '', aadhaarFile: '', monthlyIncome: '', bankName: '', accountNumber: '', ifsc: '' })
  const [collateralValue, setCollateralValue] = useState('')
  const [statement, setStatement] = useState({ fileName: '', averageMonthlyBalance: '', monthCount: 0, error: '', source: '' })
  const [scanning, setScanning] = useState(false)
  const [scanSeconds, setScanSeconds] = useState(15)
  const [score, setScore] = useState(null)
  const [product, setProduct] = useState('Personal loan')
  const [amount, setAmount] = useState('')
  const [repaymentType, setRepaymentType] = useState('Regular EMI')
  const [frequency, setFrequency] = useState('Monthly')
  const [application, setApplication] = useState(null)
  const [signed, setSigned] = useState(false)
  const [signatureData, setSignatureData] = useState('')
  const [activationReference, setActivationReference] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const products = [
    { name: 'Personal loan', detail: 'Fast approval', icon: UserRound },
    { name: 'Loan against mutual fund', detail: 'Flexible, asset-backed', icon: TrendingUp },
    { name: 'Business loan', detail: 'Working capital', icon: BriefcaseBusiness },
    { name: 'Two Wheeler loan', detail: 'Fast transit', icon: ArrowRight },
    { name: 'Loan against property', detail: 'Secured credit', icon: Landmark },
  ]
  const loanLimit = score ? Math.min(score.limit, Number(kyc.monthlyIncome || 0) * 8, Number(collateralValue) > 0 ? Number(collateralValue) * 0.8 : Number.POSITIVE_INFINITY) : 0
  const statementHighRisk = statement.monthCount >= 3 && Number(kyc.monthlyIncome) > 0 && Number(statement.averageMonthlyBalance) < Number(kyc.monthlyIncome) * 0.25
  const offerReady = ['APPROVED', 'SANCTIONED'].includes(activeLoan?.approvalState)
  const paymentPending = activeLoan?.approvalState === 'PAYMENT_PENDING'
  const activationAmount = activeLoan?.installment || 0
  const activationUpiUrl = activeLoan
    ? `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent('DevMan Lending')}&am=${activationAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Loan-${activeLoan.id}-Approval`)}`
    : ''
  const activationAppLinks = [
    { name: 'PhonePe', href: activationUpiUrl.replace('upi://pay?', 'phonepe://pay?') },
    { name: 'Google Pay', href: activationUpiUrl.replace('upi://pay?', 'gpay://upi/pay?') },
    { name: 'Paytm', href: activationUpiUrl.replace('upi://pay?', 'paytmmp://pay?') },
    { name: 'BHIM', href: activationUpiUrl.replace('upi://pay?', 'bhim://upi/pay?') },
  ]

  const handleStatementUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setStatement((current) => ({ ...current, error: 'Choose a statement smaller than 10 MB.' }))
      return
    }
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension === 'pdf') {
      setStatement({ fileName: file.name, averageMonthlyBalance: '', monthCount: 0, error: '', source: 'PDF' })
      return
    }
    if (extension !== 'csv') {
      setStatement((current) => ({ ...current, error: 'Upload a CSV or PDF bank statement.' }))
      return
    }
    try {
      const parsed = parseStatementCsv(await file.text())
      const lowBalance = Number(kyc.monthlyIncome) > 0 && parsed.averageMonthlyBalance < Number(kyc.monthlyIncome) * 0.25
      setStatement({ fileName: file.name, ...parsed, error: '', source: 'CSV', highRisk: lowBalance })
    } catch (error) {
      setStatement((current) => ({ ...current, fileName: file.name, error: error.message, source: 'CSV', monthCount: 0 }))
    }
  }
  const confirmPdfStatement = () => {
    const average = Number(statement.averageMonthlyBalance)
    if (!statement.fileName.toLowerCase().endsWith('.pdf') || !statement.averageMonthlyBalance.trim() || !Number.isFinite(average) || average < 0) {
      notify('Choose a PDF statement and enter its 3-month average balance.')
      return
    }
    setStatement((current) => ({
      ...current,
      averageMonthlyBalance: average,
      monthCount: 3,
      highRisk: Number(kyc.monthlyIncome) > 0 && average < Number(kyc.monthlyIncome) * 0.25,
      error: '',
    }))
  }
  useEffect(() => {
    if (!scanning) return undefined
    const timer = window.setTimeout(() => {
      const assessment = creditRiskAssessment({
        monthlyIncome: kyc.monthlyIncome,
        collateralValue,
        loanAmount: Number(amount) || Number(kyc.monthlyIncome) * 3,
        history: creditHistory,
        averageBalance: statement.averageMonthlyBalance,
      })
      const limit = assessment.risk === 'Low' ? 500000 : assessment.risk === 'Medium' ? 250000 : 75000
      setScore({ ...assessment, limit })
      setAmount((current) => current || String(Math.min(limit, Math.max(10000, Number(kyc.monthlyIncome) * 3))))
      setScanning(false)
      notify(`Eligibility assessment complete. Score ${assessment.score}/900 · ${assessment.risk.toLowerCase()} risk.`)
    }, 15000)
    const countdown = window.setInterval(() => setScanSeconds((current) => Math.max(0, current - 1)), 1000)
    return () => { window.clearTimeout(timer); window.clearInterval(countdown) }
  }, [scanning, kyc.monthlyIncome, collateralValue, amount, creditHistory, statement.averageMonthlyBalance, notify])

  const checkEligibility = () => {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(kyc.pan.toUpperCase()) || !/^\d{12}$/.test(kyc.aadhaar) || Number(kyc.monthlyIncome) <= 0 || !kyc.bankName.trim() || !/^\d{8,18}$/.test(kyc.accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(kyc.ifsc.toUpperCase()) || statement.monthCount < 3) {
      notify('Enter valid identity, income and bank details, then analyze a 3-month bank statement.')
      return
    }
    setScore(null)
    setScanSeconds(15)
    setScanning(true)
  }
  const submitApplication = () => {
    const requested = Number(amount)
    if (!score || !product || requested < 10000 || requested > loanLimit) {
      notify(`Choose a valid amount between ₹10,000 and ${money(loanLimit)}.`)
      return
    }
    if (!signatureData) {
      notify('Please sign the digital agreement before applying.')
      return
    }
    const newApplication = onApply({
      product, amount: requested, repaymentType, frequency, term: 12, rate: 1.75,
      interestMethod: 'Reducing balance · EMI', risk: `${score.risk} risk`,
      monthlyIncome: Number(kyc.monthlyIncome), panNumber: `${kyc.pan.slice(0, 2)}****${kyc.pan.slice(-1)}`,
      aadhaarNumber: `********${kyc.aadhaar.slice(-4)}`, panFile: kyc.panFile, aadhaarFile: kyc.aadhaarFile,
      bankName: kyc.bankName.trim(), accountNumber: `••••${kyc.accountNumber.slice(-4)}`, ifsc: kyc.ifsc.toUpperCase(),
      collateralValue: Number(collateralValue) || 0, digitalSignature: signatureData,
    })
    setApplication(newApplication)
    setSigned(false)
  }
  const askAssistant = (event) => {
    event.preventDefault()
    const text = question.toLowerCase()
    const response = text.includes('girvi') || text.includes('maturity') || text.includes('block')
      ? activeLoan?.repaymentType === 'Girvi'
        ? `Your Girvi loan's principal of ${money(activeLoan.principal - activeLoan.paid)} is due on ${activeLoan.maturityDate || 'the maturity date'}. Monthly payments cover interest until then.`
        : 'Girvi is an interest-only plan: monthly Byaaj is due, and principal is due at maturity.'
      : text.includes('late') || text.includes('fee')
        ? 'If a payment is overdue, check your loan schedule or contact support to confirm any applicable late fee.'
        : text.includes('agent') || text.includes('settle')
          ? 'Field collections are recorded against your account. Ask support if you need help matching a cash receipt.'
          : `Your next installment is ${activeLoan ? money(activeLoan.installment) : 'shown after loan approval'}. You can review your schedule and pay securely from your portal.`
    setAnswer(response)
    setQuestion('')
  }

  return <section className="journey-section">
    <PageHeading eyebrow="SELF-SERVICE · DIGITAL KYC" title={activeLoan ? 'Explore your next loan' : `Welcome, ${profile.name.split(' ')[0]}`} subtitle="Verify your profile once, see an indicative limit, and apply online." />
    <div className="journey-steps" aria-label="Borrower application steps"><span className={score ? 'complete' : 'current'}><i>01</i> Verify identity</span><span className={score ? 'current' : ''}><i>02</i> Check eligibility</span><span className={application || offerReady ? 'complete' : ''}><i>03</i> Choose a plan</span><span className={activeLoan?.approvalState === 'ACTIVE' ? 'complete' : ''}><i>04</i> Bank transfer</span></div>
    {activeLoan?.approvalState === 'UNDER_REVIEW' && <section className="online-flow-card flow-review"><div className="flow-status-icon"><Clock3 size={18} /></div><div><span className="section-kicker">APPLICATION · {activeLoan.id}</span><h2>Application under review</h2><p>Your lender will review your request. Online payment and disbursement activation unlock after an offer is approved.</p></div><StatusBadge status="Under review" /></section>}
    {offerReady && <section className="online-flow-card flow-offer"><div className="flow-status-icon"><ShieldCheck size={18} /></div><div className="flow-offer-content"><span className="section-kicker">LENDER OFFER · {activeLoan.id}</span><h2>Review your sanctioned terms</h2><p className="sanction-alert">Admin has sanctioned {money(activeLoan.sanctionedAmount ?? activeLoan.principal)} with monthly interest of {money(Math.round((activeLoan.sanctionedAmount ?? activeLoan.principal) * (activeLoan.sanctionedRate ?? activeLoan.rate) / 100))}.</p><div className="flow-term-grid"><span>Sanctioned amount<b>{money(activeLoan.sanctionedAmount ?? activeLoan.principal)}</b></span><span>First installment / interest<b>{money(activeLoan.installment)}</b></span><span>Repayment plan<b>{activeLoan.repaymentType} · {activeLoan.frequency}</b></span><span>Interest rate<b>{activeLoan.sanctionedRate ?? activeLoan.rate}% per month</b></span></div><p className="flow-disclaimer">Accepting locks these terms for this demo session. Read the schedule before proceeding.</p><button className="primary-button" onClick={() => onAcceptOffer(activeLoan.id)}>Accept & Proceed <ArrowRight size={15} /></button></div></section>}
    {paymentPending && <section className="online-flow-card flow-payment"><div className="flow-payment-header"><div><span className="section-kicker">ONLINE PAYMENT & DISBURSEMENT</span><h2>Pay the first scheduled installment</h2><p>Offer accepted · {activeLoan.id} · due now to initiate the lender's settlement review.</p></div><span className="flow-amount">{money(activationAmount)}</span></div><div className="activation-payment-layout"><div className="activation-qr"><QRCodeSVG value={activationUpiUrl} title="UPI payment QR code" size={172} bgColor="#ffffff" fgColor="#111827" level="M" /><b>Scan with any UPI app</b><small>{vpa} · INR</small></div><div className="activation-pay-options"><div className="activation-app-links">{activationAppLinks.map((app) => <a className="secondary-button" href={app.href} key={app.name}>{app.name}</a>)}</div><a className="primary-button open-upi-app" href={activationUpiUrl}><IndianRupee size={15} /> Open UPI App</a><p>Direct UPI intent to the configured lender address. No payment gateway is used by this demo; any charges imposed by a bank or UPI app still apply.</p><form className="activation-utr-form" onSubmit={(event) => { event.preventDefault(); if (!/^\d{12}$/.test(activationReference)) { notify('Enter the 12-digit UPI reference / UTR from your payment app.'); return } if (onSubmitActivationPayment(activeLoan.id, activationReference)) setActivationReference('') }}><label>Enter 12-digit UPI Reference / UTR Number<input value={activationReference} onChange={(event) => setActivationReference(event.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" pattern="[0-9]{12}" minLength="12" maxLength="12" placeholder="12 digits" required /></label><button className="primary-button" disabled={activationReference.length !== 12}>Submit payment reference <ArrowRight size={14} /></button></form></div></div><p className="activation-warning"><AlertTriangle size={15} /> Submitting a UTR is a borrower-reported reference only—not proof of payment. The lender must independently verify settlement before releasing funds.</p></section>}
    {activeLoan?.approvalState === 'ACTIVE' && activeLoan.activationPayment && <section className="online-flow-card flow-active"><div className={`activation-submitted ${activeLoan.activationPayment.status === 'VERIFIED' ? 'verified' : ''}`}><CheckCircle2 size={20} /><div><span className="section-kicker">{activeLoan.activationPayment.status === 'VERIFIED' ? 'SETTLEMENT VERIFIED' : 'REFERENCE SUBMITTED'} · {activeLoan.id}</span><h2>{activeLoan.activationPayment.status === 'VERIFIED' ? 'Payment verified · disbursement recorded' : 'Payment reported · verification pending'}</h2><p>{activeLoan.activationPayment.status === 'VERIFIED' ? `Your lender recorded the bank transfer reference ${activeLoan.activationPayment.disbursementUtr}.` : 'Your lender must independently verify the UPI settlement. This demo does not confirm receipt or release a bank transfer.'}</p></div></div><div className="repayment-voucher" id="repayment-voucher"><div className="voucher-brand"><b>DevMan Lending</b><span>NON-COMMERCIAL REPAYMENT VOUCHER · PAAVTI</span></div><div className="voucher-rule" /><div className="voucher-data"><span>Loan reference<b>{activeLoan.id}</b></span><span>Borrower<b>{profile.name}</b></span><span>Transaction ID / UTR<b>{activeLoan.activationPayment.reference}</b></span><span>UPI amount<b>{money(activeLoan.activationPayment.amount)}</b></span><span>Reported at<b>{new Date(activeLoan.activationPayment.submittedAt).toLocaleString('en-IN')}</b></span><span>Settlement status<b>{activeLoan.activationPayment.status === 'VERIFIED' ? `Verified · ${new Date(activeLoan.activationPayment.verifiedAt).toLocaleString('en-IN')}` : 'Reported by borrower · pending lender verification'}</b></span>{activeLoan.activationPayment.status === 'VERIFIED' && <span>Bank disbursement reference<b>{activeLoan.activationPayment.disbursementUtr}</b></span>}</div>{activeLoan.digitalSignature && <div className="voucher-borrower-sign"><span>Borrower signature</span><img src={activeLoan.digitalSignature} alt="Borrower signature" /></div>}<p>{activeLoan.activationPayment.status === 'VERIFIED' ? 'This non-commercial voucher reflects a lender-recorded manual verification and disbursement reference. It is not generated or confirmed by a bank or payment provider.' : 'This non-commercial acknowledgement records a borrower-submitted payment reference only. It is not a bank-generated receipt or confirmation that funds have cleared.'}</p></div><button className="secondary-button voucher-print-button" onClick={() => printDocument('repayment-voucher')}><Download size={15} /> Print / Save PDF paavti</button></section>}
    <div className="eligibility-layout">
      <article className="panel kyc-panel">
        <div className="panel-header"><div><div className="section-kicker">AUTOMATED PROFILE CHECK</div><h2>Identity & income</h2></div><span className="secure-tag"><ShieldCheck size={14} /> Encrypted demo</span></div>
        <div className="kyc-form-grid">
          <label>PAN number<input value={kyc.pan} onChange={(event) => setKyc({ ...kyc, pan: event.target.value.toUpperCase().slice(0, 10) })} placeholder="ABCDE1234F" autoComplete="off" /></label>
          <label>Aadhaar / address number<input value={kyc.aadhaar} onChange={(event) => setKyc({ ...kyc, aadhaar: event.target.value.replace(/\D/g, '').slice(0, 12) })} inputMode="numeric" placeholder="12-digit number" autoComplete="off" /></label>
          <label>Monthly take-home income<input type="number" min="1" value={kyc.monthlyIncome} onChange={(event) => setKyc({ ...kyc, monthlyIncome: event.target.value })} placeholder="₹ 45,000" /></label>
          <label>Bank name<input value={kyc.bankName} onChange={(event) => setKyc({ ...kyc, bankName: event.target.value })} placeholder="Your salary account bank" autoComplete="organization" /></label>
          <label>Bank account number<input type="password" inputMode="numeric" value={kyc.accountNumber} onChange={(event) => setKyc({ ...kyc, accountNumber: event.target.value.replace(/\D/g, '').slice(0, 18) })} placeholder="8–18 digits" autoComplete="off" /></label>
          <label>IFSC code<input value={kyc.ifsc} onChange={(event) => setKyc({ ...kyc, ifsc: event.target.value.toUpperCase().slice(0, 11) })} placeholder="ABCD0123456" autoComplete="off" /></label>
          <label>Collateral value (optional)<input type="number" min="0" value={collateralValue} onChange={(event) => setCollateralValue(event.target.value)} placeholder="₹ 0 if unsecured" /></label>
        </div>
        <div className="kyc-upload-grid">
          <label className="kyc-upload"><FileText size={17} /><span><b>PAN card photo</b><small>{kyc.panFile || 'Choose image or use camera'}</small></span><input type="file" accept="image/*" capture="environment" onChange={(event) => setKyc({ ...kyc, panFile: event.target.files?.[0]?.name || '' })} /></label>
          <label className="kyc-upload"><FileText size={17} /><span><b>Aadhaar card photo</b><small>{kyc.aadhaarFile || 'Choose image or use camera'}</small></span><input type="file" accept="image/*" capture="environment" onChange={(event) => setKyc({ ...kyc, aadhaarFile: event.target.files?.[0]?.name || '' })} /></label>
        </div>
        <details className="statement-drawer">
          <summary><FileUp size={16} /><span><b>Analyze a 3-month bank statement</b><small>{statement.fileName || 'Upload CSV for parsing or PDF for local manual review'}</small></span><ArrowRight size={14} /></summary>
          <div className="statement-panel">
            <label className="kyc-upload statement-file"><FileUp size={17} /><span><b>Choose PDF or CSV statement</b><small>Processed in this browser · max 10 MB</small></span><input type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={handleStatementUpload} /></label>
            {statement.source === 'PDF' && <><p className="statement-hint">PDF contents are not uploaded or sent anywhere. This demo does not include a PDF text-extraction engine; enter the 3-month average balance shown on your statement.</p><label>Average monthly balance (₹)<input type="number" min="0" value={statement.averageMonthlyBalance} onChange={(event) => setStatement({ ...statement, averageMonthlyBalance: event.target.value })} placeholder="Enter average from statement" /></label><button className="secondary-button" type="button" onClick={confirmPdfStatement}>Confirm 3-month PDF analysis</button></>}
            {statement.monthCount >= 3 && <div className={`statement-result ${statementHighRisk ? 'high-risk' : ''}`}><CheckCircle2 size={16} /><span>{statement.source === 'CSV' ? 'Parsed 3 months' : 'PDF analysis confirmed'} · average monthly balance <b>{money(Number(statement.averageMonthlyBalance))}</b>{statementHighRisk && <strong>Low cashflow buffer: elevated risk flag</strong>}</span></div>}
            {statement.error && <p className="statement-error" role="alert">{statement.error}</p>}
          </div>
        </details>
        <div className="kyc-actions"><span><ShieldCheck size={15} /> Your identity details stay in this demo session.</span><button className="primary-button" disabled={scanning} onClick={checkEligibility}>{scanning ? <><Activity size={15} /> Scanning · {scanSeconds}s</> : <><ShieldCheck size={15} /> Check eligibility</>}</button></div>
        {scanning && <div className="scan-progress" role="status"><i /><span>Checking identity, income and indicative affordability · typically 15–30 seconds</span></div>}
      </article>
      <article className={`score-card ${score ? `score-${score.risk.toLowerCase()}` : ''}`}>
        {score ? <RiskDial score={score.score} risk={score.risk} /> : <div className="score-orbit"><div><span>—</span><small>NOT CHECKED</small></div></div>}
        <span className="section-kicker">DIGITAL ELIGIBILITY</span>
        <h2>{score ? `${score.risk} risk · ${score.score}/900` : 'Your profile score'}</h2>
        <p>{score ? `Income, collateral and ${creditHistory.length} own-account loan record(s) · statement ${statement.monthCount >= 3 ? 'analyzed' : 'not supplied'}. Indicative only.` : 'Complete identity and financial details to unlock your indicative profile limit.'}</p>
        <div className="score-limit"><span>Indicative borrowing limit</span><b>{score ? money(loanLimit) : '—'}</b></div>
        {score && <span className="score-state"><CheckCircle2 size={14} /> Identity check completed</span>}
      </article>
    </div>
    {score && <section className="product-section">
      <div className="product-heading"><div><div className="section-kicker">LENDPRO DIGITAL LOAN SUITE</div><h2>Choose what you need</h2></div><span>Indicative offers · subject to verification</span></div>
      <div className="product-grid">{products.map(({ name, detail, icon: Icon }) => <button type="button" key={name} onClick={() => setProduct(name)} className={`product-card ${product === name ? 'selected' : ''}`}><span className="product-icon"><Icon size={17} /></span><b>{name}</b><small>{detail}</small>{product === name && <CheckCircle2 size={15} className="product-check" />}</button>)}</div>
      <div className="application-panel">
        <div className="application-fields"><label>Requested amount (₹)<input type="number" min="10000" max={loanLimit} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Repayment plan<select value={repaymentType} onChange={(event) => setRepaymentType(event.target.value)}><option>Regular EMI</option><option>Girvi</option></select></label><label>Repayment frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value)}><option>Monthly</option><option>Weekly</option><option>Daily</option></select></label></div>
        <div className="application-plan-note">{repaymentType === 'Girvi' ? 'Girvi / interest-only: monthly Byaaj, with principal due in one payment on the maturity date.' : 'Regular reducing-balance EMI: each installment includes principal and interest.'}</div>
        <div className="application-signature"><b>Digital agreement signature</b><small>Sign with touch, mouse, or stylus before submitting.</small><SignaturePad onChange={setSignatureData} /><span className={signatureData ? 'signature-ready' : ''}>{signatureData ? 'Signature captured for voucher and repayment slip.' : 'Signature required to apply.'}</span></div>
        <button className="primary-button" onClick={submitApplication} disabled={!signatureData}><ArrowRight size={15} /> Apply for {product}</button>
      </div>
    </section>}
    {activeLoan?.disbursementStage && !activeLoan.approvalState && <section className="disbursement-track"><div><div className="section-kicker">APPLICATION · {activeLoan.id}</div><h2>Bank disbursement</h2></div><div className="disbursement-stages">{['Processing Profile', 'Bank Verification', 'Disbursed'].map((stage) => <span className={['Processing Profile', 'Bank Verification', 'Disbursed'].indexOf(activeLoan.disbursementStage) >= ['Processing Profile', 'Bank Verification', 'Disbursed'].indexOf(stage) ? 'active' : ''} key={stage}><i>{activeLoan.disbursementStage === stage ? <Clock3 size={13} /> : <Check size={13} />}</i>{stage}</span>)}</div><p>{activeLoan.disbursementStage === 'Disbursed' ? `Disbursed to bank · estimated 15-minute delivery. Demo UTR captured: ${activeLoan.disbursement?.utr || 'processing'}.` : `${activeLoan.disbursementStage} · Your application is moving through secure verification.`}</p></section>}
    {application && <div className="application-overlay" role="dialog" aria-modal="true" aria-label="Application confirmation"><article className="application-confirmation"><button className="icon-button close-application" onClick={() => setApplication(null)} aria-label="Close confirmation"><X size={18} /></button><div className="application-success"><CheckCircle2 size={23} /><span>APPLICATION IN PROCESS</span></div><h2>We’ve received your request.</h2><p>{application.id} · {application.type} · {money(application.principal)}</p><div className="confirmation-content"><div className="confirmation-qr"><QRCodeSVG value={`upi://pay?pa=lender@upi&pn=LendPro&am=${application.installment}&tn=${application.id}`} size={110} bgColor="#ffffff" fgColor="#111827" /><small>Indicative repayment · {money(application.installment)}</small></div><div><b>Repayment preview</b><span>{application.repaymentType === 'Girvi' ? 'Monthly interest-only; principal at maturity.' : `${application.frequency} · ${application.term} installments`}</span><div className="confirmation-schedule">{buildSchedule(application).slice(0, 3).map((row) => <span key={row.number}>#{row.number} · {row.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · {money(row.installment)}</span>)}</div><b>SMS & WhatsApp confirmation</b><span>Application summary and payment schedule are ready to share.</span><a className="secondary-button" href={`https://wa.me/?text=${encodeURIComponent(`LendPro application ${application.id}: ${money(application.principal)} request submitted. Indicative installment ${money(application.installment)}.`)}`} target="_blank" rel="noreferrer">Open WhatsApp confirmation <ArrowRight size={14} /></a></div></div><div className="sanction-voucher" id="sanction-voucher"><b>LendPro · Indicative sanction voucher</b><span>{application.id} · {application.type} · {money(application.principal)}</span><span>{application.repaymentType} · {application.frequency} · {money(application.installment)} indicative installment</span><span>Indicative only; final approval and disbursement require lender review.</span><img src={application.digitalSignature} alt="Borrower digital signature" /></div><button className="secondary-button sanction-print-button" onClick={() => printDocument('sanction-voucher')}><Download size={14} /> Print sanction voucher</button><label className="digital-sign"><input type="checkbox" checked={signed} onChange={(event) => setSigned(event.target.checked)} /> I confirm these indicative terms and authorize digital acknowledgement.</label><button className="primary-button full-button" disabled={!signed} onClick={() => { setApplication(null); notify('Digital acknowledgement recorded for this demo.') }}>Sign & continue <Check size={15} /></button><small className="confirmation-disclaimer">Demo only: no credit decision, bank transfer, UPI payment, SMS or WhatsApp message is actually processed.</small></article></div>}
    <button className="assistant-launcher" onClick={() => setChatOpen(!chatOpen)}><CircleHelp size={17} /> Ask LendPro AI</button>
    {chatOpen && <aside className="assistant-drawer" aria-label="LendPro AI support"><div><div><b>Ask LendPro AI</b><small>Answers based on your account</small></div><button className="icon-button" onClick={() => setChatOpen(false)} aria-label="Close support"><X size={16} /></button></div><p>{answer || (language === 'हि' ? 'किस्त, ब्याज या भुगतान के बारे में पूछें।' : 'Ask about EMIs, Girvi maturity, late fees or payments.')}</p><form onSubmit={askAssistant}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question…" aria-label="Ask LendPro AI" /><button className="primary-button" type="submit" disabled={!question.trim()}><ArrowRight size={15} /></button></form></aside>}
  </section>
}

function RiskDial({ score, risk }) {
  const progress = Math.max(0, Math.min(1, (score - 300) / 600))
  const angle = -135 + progress * 270
  const radians = angle * Math.PI / 180
  const x = 70 + 54 * Math.cos(radians)
  const y = 70 + 54 * Math.sin(radians)
  const color = risk === 'Low' ? '#83f7d2' : risk === 'Medium' ? '#f4c77c' : '#ff8187'
  return <svg className={`risk-dial risk-dial-${risk.toLowerCase()}`} viewBox="0 0 140 92" role="img" aria-label={`${risk} risk credit score ${score} out of 900`}>
    <path d="M 28 70 A 42 42 0 1 1 112 70" fill="none" stroke="rgba(150,170,180,.2)" strokeWidth="9" strokeLinecap="round" />
    <path d="M 28 70 A 42 42 0 1 1 112 70" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" pathLength="100" strokeDasharray={`${progress * 100} 100`} />
    <circle cx={x} cy={y} r="5" fill={color} />
    <text x="70" y="58" textAnchor="middle" className="risk-dial-score">{score}</text>
    <text x="70" y="74" textAnchor="middle" className="risk-dial-caption">CREDIT SCORE</text>
    <text x="17" y="88" className="risk-dial-end">300</text>
    <text x="99" y="88" className="risk-dial-end">900</text>
  </svg>
}

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const point = (event) => {
    const canvas = canvasRef.current
    const bounds = canvas.getBoundingClientRect()
    return { x: (event.clientX - bounds.left) * canvas.width / bounds.width, y: (event.clientY - bounds.top) * canvas.height / bounds.height }
  }
  const start = (event) => {
    event.preventDefault()
    drawing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const context = canvasRef.current.getContext('2d')
    const current = point(event)
    context.lineWidth = 4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#142226'
    context.beginPath()
    context.moveTo(current.x, current.y)
  }
  const move = (event) => {
    if (!drawing.current) return
    event.preventDefault()
    const context = canvasRef.current.getContext('2d')
    const current = point(event)
    context.lineTo(current.x, current.y)
    context.stroke()
    hasInk.current = true
  }
  const finish = () => {
    drawing.current = false
    if (hasInk.current) onChange(canvasRef.current.toDataURL('image/png'))
  }
  const clear = () => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
    onChange('')
  }
  useEffect(() => { clear() }, [])
  return <div className="signature-pad">
    <canvas ref={canvasRef} width="720" height="160" aria-label="Draw your digital signature" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} />
    <button className="secondary-button compact" type="button" onClick={clear}>Clear signature</button>
  </div>
}

function WorkspaceAssistant({ role, dueCount, cash, commission, vpa }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const ask = (event) => {
    event.preventDefault()
    const text = question.toLowerCase()
    const response = text.includes('girvi') || text.includes('maturity') || text.includes('block')
      ? 'Girvi repayments are interest-only until maturity; the remaining principal is due as a single bullet payment on the block date.'
      : text.includes('fee') || text.includes('overdue') || text.includes('late')
        ? `Review the loan grace period and configured late-fee policy before collecting. ${dueCount} accounts currently need attention.`
        : text.includes('upi') || text.includes('deposit') || text.includes('payment')
          ? `Use the exact amount shown on the payment screen. The configured demo lender UPI ID is ${vpa}; verify it before any real transfer.`
          : text.includes('agent') || text.includes('settle') || role === 'Agent'
            ? `Your field cash balance is ${money(cash)} with ${money(commission)} commission accrued. Record the collection and submit a cash handover for owner approval.`
            : `There are ${dueCount} collections needing attention. Review the loan ledger for current eligibility and disbursement stages.`
    setAnswer(response)
    setQuestion('')
  }
  return <>
    <button className="assistant-launcher" onClick={() => setOpen(!open)}><CircleHelp size={17} /> Ask LendPro AI</button>
    {open && <aside className="assistant-drawer" aria-label="LendPro AI workspace support"><div><div><b>Ask LendPro AI</b><small>{role} workspace assistant</small></div><button className="icon-button" onClick={() => setOpen(false)} aria-label="Close support"><X size={16} /></button></div><p>{answer || 'Ask about EMI, Girvi dates, deposits, late fees or agent settlements.'}</p><form onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a question…" aria-label="Ask LendPro AI" /><button className="primary-button" type="submit" disabled={!question.trim()}><ArrowRight size={15} /></button></form></aside>}
  </>
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function Overview({ loans, outstanding, activeLoans, openPage, exportCsv, exportExcel, setModal, openPayment, openReminder, agentCash, ownerCash, settlements }) {
  const paidOff = loans.filter((loan) => loan.status === 'Paid off').length
  const overdue = loans.filter((loan) => loan.status.startsWith('Overdue')).length
  const dueToday = loans.filter((loan) => loan.status === 'Due today')
  const totalDeployed = loans.reduce((sum, loan) => sum + loan.principal, 0)
  const collected = loans.reduce((sum, loan) => sum + loan.paid, 0)
  return <>
    <PageHeading eyebrow="FRIDAY, 23 OCTOBER 2026" title="Good morning, Saanvi" subtitle="Here’s what’s happening across your lending portfolio today." action={<button className="primary-button" onClick={() => setModal('newLoan')}><Plus size={17} /> Create new loan</button>} />
    <section className="metric-grid">
      <MetricCard title="Capital deployed" value={money(totalDeployed)} change="+12.8%" note="vs. last month" icon={Landmark} tone="cyan" mini="₹" />
      <MetricCard title="Principal collected" value={money(collected)} change="+8.2%" note="this month" icon={ArrowDownLeft} tone="green" mini="↗" />
      <MetricCard title="Interest earned" value={money(loans.reduce((sum, loan) => sum + (loan.interestPaid || 0), 0))} change="+4.6%" note="net profit · YTD" icon={TrendingUp} tone="violet" mini="✳" />
      <MetricCard title="Outstanding balance" value={money(outstanding)} change={`${overdue} overdue`} note={`${money(loans.reduce((sum, loan) => sum + loan.overduePenalty, 0))} accrued penalties`} icon={Wallet} tone="amber" mini="!" alert />
      <MetricCard title="Agent cash liability" value={money(agentCash)} change="Field cash" note="Pending owner handover" icon={Banknote} tone="violet" mini="₹" />
    </section>
    <div className="portfolio-status-strip"><span><i className="dot green-dot" /><b>{activeLoans.length} active</b><small>loans</small></span><span><i className="dot" /><b>{paidOff} paid off</b><small>loans</small></span><span className={overdue ? 'strip-alert' : ''}><i className="dot red-dot" /><b>{overdue} overdue</b><small>needs attention</small></span><span className="strip-risk"><ShieldCheck size={14} /><b>{money(loans.reduce((sum, loan) => sum + loan.overduePenalty, 0))}</b><small>unpaid penalties</small></span><span className="owner-cash"><Banknote size={14} /><b>{money(ownerCash)}</b><small>owner cash in hand</small></span></div>
    {settlements.length > 0 && <div className="settlement-log"><b>Recent cash handovers</b>{settlements.slice(0, 2).map((settlement) => <span key={settlement.id}>{settlement.agent} · {money(settlement.amount)} · {new Date(settlement.date).toLocaleDateString('en-IN')}</span>)}</div>}
    <section className="overview-grid">
      <div className="panel portfolio-panel"><div className="panel-header"><div><div className="section-kicker">PORTFOLIO PERFORMANCE</div><h2>Cash flow overview</h2></div><button className="select-period" onClick={() => openPage('Reports')}>Last 7 months <ChevronDown size={14} /></button></div><div className="chart-legend"><span><i className="legend-principal" /> Principal collected</span><span><i className="legend-interest" /> Interest earned</span></div><div className="chart-area"><div className="chart-y-labels"><span>₹6L</span><span>₹4L</span><span>₹2L</span><span>₹0</span></div><div className="chart-main"><div className="chart-grid-lines"><i /><i /><i /><i /></div><div className="bar-groups">{[['APR',34,18],['MAY',48,25],['JUN',42,22],['JUL',67,32],['AUG',58,27],['SEP',76,37],['OCT',89,43]].map(([month, principal, interest]) => <div className="bar-group" key={month}><div className="bars"><span className="bar principal-bar" style={{ height: `${principal}%` }} /><span className="bar interest-bar" style={{ height: `${interest}%` }} /></div><small>{month}</small></div>)}</div></div></div><div className="chart-insight"><div className="insight-icon"><TrendingUp size={16} /></div><span><b>On an upward trend.</b> Collections are up <strong>18.4%</strong> compared to last month.</span><button onClick={() => openPage('Reports')}>View report <ArrowRight size={14} /></button></div></div>
      <div className="panel portfolio-health"><div className="panel-header"><div><div className="section-kicker">PORTFOLIO HEALTH</div><h2>Looking healthy</h2></div><button className="icon-button subtle" aria-label="More portfolio details"><MoreHorizontal size={19} /></button></div><div className="health-ring"><div className="ring-inner"><strong>92<span>%</span></strong><small>on-time rate</small></div></div><div className="health-rows"><div><i className="dot green-dot" /><span>Performing loans</span><b>{activeLoans.length - overdue}</b></div><div><i className="dot yellow-dot" /><span>Watchlist</span><b>{loans.filter((loan) => loan.risk === 'Moderate').length}</b></div><div><i className="dot red-dot" /><span>At risk / overdue</span><b>{overdue}</b></div></div><button className="text-action" onClick={() => openPage('Loans')}>View risk portfolio <ArrowRight size={14} /></button></div>
    </section>
    <section className="panel activity-panel"><div className="panel-header"><div><div className="section-kicker">NEEDS YOUR ATTENTION</div><h2>Today’s collections <span className="count-badge">{dueToday.length + overdue}</span></h2></div><button className="text-action" onClick={() => openPage('Collections')}>View all collections <ArrowRight size={14} /></button></div><div className="table-scroll"><table><thead><tr><th>BORROWER</th><th>LOAN TYPE</th><th>DUE AMOUNT</th><th>DUE DATE</th><th>RISK</th><th /></tr></thead><tbody>{loans.filter((loan) => loan.status === 'Due today' || loan.status.startsWith('Overdue')).slice(0, 4).map((loan) => <tr key={loan.id}><td><BorrowerCell loan={loan} /></td><td>{loan.type}</td><td><b className="table-amount">{money(loan.installment + loan.overduePenalty)}</b>{loan.overduePenalty > 0 && <small className="penalty-subtext">includes {money(loan.overduePenalty)} penalty</small>}</td><td><span className={`due-label ${loan.status.startsWith('Overdue') ? 'overdue-label' : ''}`}><i />{loan.due}</span></td><td><RiskBadge risk={loan.risk} /></td><td><StatusBadge status={loan.status} /></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing {dueToday.length + overdue} collections due</span><ExportButtons exportCsv={exportCsv} exportExcel={exportExcel} /></div></section>
    <section className="bottom-actions"><div className="quick-tip"><div className="tip-icon"><Activity size={18} /></div><div><b>Ready for your next disbursement?</b><span>Create a loan in under two minutes with guided KYC.</span></div><button onClick={() => setModal('newLoan')}>Start a loan <ArrowRight size={14} /></button></div><div className="quicktip-decoration">L</div></section>
  </>
}

function MetricCard({ title, value, change, note, icon: Icon, tone, mini, alert }) {
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{title}</span><div className="metric-icon"><Icon size={17} /></div></div><div className="metric-value">{value}</div><div className="metric-foot"><span className={`metric-change ${alert ? 'alert-change' : ''}`}>{!alert && <ArrowUpRight size={13} />}{alert && <span className="alert-pulse" />}{change}</span><span>{note}</span></div><div className="metric-orb">{mini}</div><div className="metric-grid-texture" /></article>
}

function AgentDashboard({ loans, search, setSearch, openPayment, openReminder, notify, lateFee, collectedToday, agentCash, agentCommission, setModal, settlements }) {
  const dueLoans = loans.filter((loan) => loan.status === 'Due today' || loan.status.startsWith('Overdue')).sort((a, b) => a.status.startsWith('Overdue') ? -1 : b.status.startsWith('Overdue') ? 1 : 0).filter((loan) => `${loan.name} ${loan.id}`.toLowerCase().includes(search.toLowerCase()))
  const totalDue = dueLoans.reduce((sum, loan) => sum + loan.installment + loan.overduePenalty, 0)
  return <>
    <PageHeading eyebrow="FIELD OPERATIONS · FRIDAY, 23 OCTOBER" title="Your collection route" subtitle="A focused view of today's visits. Let's make every collection count." action={<button className="secondary-button route-button" onClick={() => notify('Route optimized for the shortest travel time.')}><Activity size={16} /> Optimize route</button>} />
    <section className="agent-hero"><div><div className="agent-hero-label"><span className="live-dot" /> TODAY’S FIELD PLAN</div><h2>Good morning, Arjun.</h2><p>You have <b>{dueLoans.length} collections</b> to make today. You're off to a great start.</p><div className="agent-progress"><span>Daily target</span><b>{money(collectedToday)} <small>of ₹50,000</small></b><div className="progress-track"><i style={{ width: `${Math.min(100, collectedToday / 50000 * 100)}%` }} /></div></div></div><div className="agent-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Wallet size={28} /></div><span className="orbit-number">{dueLoans.length}</span><span className="orbit-caption">STOPS TODAY</span></div></section>
    <section className="agent-kpis"><div><span><CalendarDays size={15} /> DUE TODAY</span><b>{money(totalDue)}</b><small>{dueLoans.length} borrowers · {loans.filter((loan) => loan.status.startsWith('Overdue')).length} overdue</small></div><div><span><CheckCircle2 size={15} /> COLLECTED TODAY</span><b>{money(collectedToday)}</b><small>Updated as payments are recorded</small></div><div><span><Clock3 size={15} /> ROUTE ESTIMATE</span><b>2h 45m</b><small>5.8 km · across 3 areas</small></div></section>
    <section className="agent-wallet-hub"><article className="agent-wallet-card"><div className="wallet-card-icon"><Banknote size={19} /></div><span>MY CASH IN HAND</span><b>{money(agentCash)}</b><small>Liability to owner · cash collections only</small><button className="secondary-button compact" onClick={() => setModal('settlement')} disabled={!agentCash}>Handover cash to owner <ArrowRight size={14} /></button></article><article className="agent-wallet-card commission"><div className="wallet-card-icon"><TrendingUp size={19} /></div><span>MY COMMISSION</span><b>{money(agentCommission)}</b><small>1.5% on eligible collections</small><div className="commission-note"><CheckCircle2 size={14} /> Updated automatically after collection</div></article><article className="settlement-history"><div><span>RECENT SETTLEMENTS</span><b>{settlements.length} requests</b></div>{settlements.length ? settlements.slice(0, 2).map((item) => <small key={item.id}>{item.id} · {money(item.amount)} · Pending approval</small>) : <small>No handover requests yet.</small>}</article></section>
    <section className="panel route-panel"><div className="panel-header"><div><div className="section-kicker">YOUR STOPS · 23 OCT</div><h2>Due & overdue collections</h2></div><div className="route-count">{dueLoans.length} visits</div></div><label className="search-box route-search"><Search size={16} /><input placeholder="Find a borrower..." value={search} onChange={(e) => setSearch(e.target.value)} /></label><div className="route-list">{dueLoans.length ? dueLoans.map((loan, index) => <article className="route-card" key={loan.id}><div className={`route-timeline ${index === 0 ? 'first' : ''}`}><div className="route-stop">{String(index + 1).padStart(2, '0')}</div></div><div className="route-card-main"><div className="route-card-top"><BorrowerCell loan={loan} /><span className={`due-label ${loan.status.startsWith('Overdue') ? 'overdue-label' : ''}`}><i />{loan.due}</span></div><StatusBadge status={loan.status} /><div className="route-meta"><span><BriefcaseBusiness size={13} />{loan.type.toLowerCase().includes('loan') ? loan.type : `${loan.type} loan`}</span><span><Banknote size={13} />{money(loan.installment + loan.overduePenalty)} due{loan.overduePenalty > 0 ? ` · ${money(loan.overduePenalty)} penalty` : ''}</span><span><Activity size={13} />{loan.address}</span></div><div className="route-actions"><button className="primary-button compact" onClick={() => openPayment(loan)}><Check size={15} /> Mark paid</button><button className="secondary-button compact" onClick={() => openReminder(loan)}><ArrowRight size={14} /> WhatsApp reminder</button><button className="icon-button route-more" aria-label={`More actions for ${loan.name}`} onClick={() => notify(`Loan ${loan.id} · ${loan.name} · ${loan.address}`)}><MoreHorizontal size={18} /></button></div></div></article>) : <div className="empty-state"><CheckCircle2 size={27} /><b>All caught up</b><span>No collections match this search.</span></div>}</div></section>
    <div className="agent-security"><ShieldCheck size={16} /><span>Field agent view · Borrower information is protected. Portfolio financials are restricted.</span></div>
  </>
}

function BorrowerPortal({ loan, payments, openPayment, openReceipt }) {
  const remaining = Math.max(0, loan.principal - loan.paid)
  const progress = loan.principal ? Math.min(100, loan.paid / loan.principal * 100) : 0
  const schedule = buildSchedule(loan)
  const maturityDays = loan.maturityDate ? Math.max(0, Math.ceil((new Date(`${loan.maturityDate}T00:00:00`).getTime() - Date.now()) / 86400000)) : null
  const nextInstallment = schedule.find((row) => row.status !== 'Paid')
  const dueDate = loan.status === 'Due today'
    ? `Due today · ${dueDateFor(loan).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`
    : loan.status.startsWith('Overdue')
      ? `${loan.due} · ${dueDateFor(loan).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`
      : nextInstallment?.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) || 'Loan fully repaid'
  return <>
    <PageHeading eyebrow="SECURE BORROWER PORTAL" title={`Namaste, ${loan.name.split(' ')[0]}`} subtitle="Your account, your loan, your records — visible only to you." />
    <div className="borrower-private-note"><ShieldCheck size={16} /><span>Private account · Only your loan and payment history are shown.</span></div>
    {loan.repaymentType === 'Girvi' && <div className="girvi-payment-note borrower-girvi-note"><b>Girvi / interest-only loan</b><span>Monthly interest due: {money(loan.installment)} · Principal due on block date: {loan.maturityDate ? new Date(`${loan.maturityDate}T00:00:00`).toLocaleDateString('en-IN') : 'maturity date'}{maturityDays !== null && ` · ${maturityDays} days remaining`} · Principal remains {money(remaining)} until maturity.</span></div>}
    <section className="borrower-hero"><div className="borrower-hero-top"><div><div className="section-kicker">YOUR LOAN ACCOUNT</div><h2>{loan.type} loan</h2><span className="borrower-loan-id">{loan.id} · {loan.phone}</span></div><StatusBadge status={loan.status === 'Due today' ? 'Active' : loan.status} /></div><div className="borrower-balance-row"><div><span>Original principal</span><b>{money(loan.principal)}</b></div><div><span>Remaining balance</span><b>{money(remaining + loan.overduePenalty)}</b></div></div>{loan.overduePenalty > 0 && <div className="borrower-penalty-alert"><AlertTriangle size={15} /><b>Overdue with Penalty</b><span>{loan.overdueDays} days late · {money(loan.overduePenalty)} unpaid, accruing {money(loan.penaltyPerDay)} daily after {loan.graceDays}-day grace.</span></div>}<div className="borrower-progress-track"><i style={{ width: `${progress}%` }} /></div><div className="borrower-progress-label"><span>{money(loan.paid)} repaid</span><b>{Math.round(progress)}%</b></div><div className="borrower-progress-details"><span>Principal repaid</span><b>{money(loan.paid)}</b><span>Interest paid</span><b>{money(loan.interestPaid || 0)}</b></div></section>
    <section className="borrower-portal-grid"><article className="next-payment-card"><div className="next-payment-icon"><CalendarDays size={19} /></div><span>NEXT INSTALLMENT</span><b>{money(loan.installment + loan.overduePenalty)}</b><small>{dueDate}</small><StatusBadge status={loan.status} />{loan.overduePenalty > 0 && <small className="penalty-subtext">Includes {money(loan.overduePenalty)} unpaid daily penalty</small>}<button className="primary-button" onClick={() => openPayment(loan)} disabled={loan.status === 'Paid off' || (loan.approvalState && loan.approvalState !== 'ACTIVE') || loan.activationPayment?.status === 'REPORTED_PENDING_VERIFICATION'}><IndianRupee size={15} /> Pay via UPI / QR</button>{loan.approvalState && loan.approvalState !== 'ACTIVE' && <small className="activation-payment-hint">Available after your lender approves your application.</small>}{loan.activationPayment?.status === 'REPORTED_PENDING_VERIFICATION' && <small className="activation-payment-hint">Your submitted reference is awaiting lender verification.</small>}</article><article className="borrower-account-card"><div className="section-kicker">LOAN ACCOUNT</div><div><span>Interest rate</span><b>{loan.rate}% / month · {loan.interestMethod || 'Flat rate'}</b></div><div><span>Repayment frequency</span><b>{loan.frequency} · {loan.term} installments</b></div><div><span>Loan status</span><b>{loan.status === 'Paid off' ? 'Fully repaid' : loan.status.startsWith('Overdue') ? 'Payment overdue' : loan.status === 'Processing' ? 'Application processing' : loan.status === 'Under review' ? 'Awaiting lender review' : loan.status === 'Approved' || loan.status === 'Sanctioned' ? 'Offer ready to accept' : loan.approvalState === 'ACTIVE' ? 'Active · payment reference pending verification' : 'In good standing'}</b></div><div><span>Account reference</span><b>{loan.id}</b></div><p>Your lender can help if you have a question about this account.</p></article></section>
    <section className="panel borrower-receipts"><div className="panel-header"><div><div className="section-kicker">VERIFIED PAYMENT RECORDS</div><h2>Your receipts</h2></div><span className="route-count">{payments.length} receipts</span></div><div className="borrower-receipt-list">{payments.length ? payments.map((receipt) => <article key={receipt.id} className="borrower-receipt-row"><div className="receipt-row-icon"><CheckCircle2 size={16} /></div><div><b>{money(receipt.amount)}</b><small>{new Date(receipt.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · {receipt.mode}</small></div><span className="receipt-reference">{receipt.id}</span><button className="secondary-button compact" onClick={() => openReceipt(receipt)}><FileText size={14} /> View voucher</button></article>) : <div className="empty-state"><FileText size={24} /><b>No receipts yet</b><span>Receipts for your payments will appear here.</span></div>}</div></section>
  </>
}

function LoanDirectory({ loans, search, setSearch, filter, setFilter, openPayment, openReminder, setSelected, setModal, exportCsv, exportExcel, title }) {
  return <>
    <PageHeading eyebrow="LENDING WORKSPACE" title={title} subtitle={title === 'Collections' ? 'Track upcoming dues and record borrower payments.' : title === 'Borrowers' ? 'A clear view of every borrower and their lending relationship.' : 'Manage your portfolio, loan terms and repayment activity.'} action={<button className="primary-button" onClick={() => setModal('newLoan')}><Plus size={17} /> Create new loan</button>} />
    <div className="directory-kpis"><div><span>Active loans</span><b>{loans.filter((loan) => loan.status !== 'Paid off' && isCapitalizedLoan(loan)).length}</b></div><div><span>Outstanding incl. penalty</span><b>{money(loans.reduce((sum, loan) => sum + (isCapitalizedLoan(loan) ? Math.max(0, loan.principal - loan.paid) + loan.overduePenalty : 0), 0))}</b></div><div><span>Overdue with penalty</span><b className="red-text">{loans.filter((loan) => loan.status.startsWith('Overdue')).length} · {money(loans.reduce((sum, loan) => sum + loan.overduePenalty, 0))}</b></div><div><span>Paid off</span><b>{loans.filter((loan) => loan.status === 'Paid off').length}</b></div></div>
    <section className="panel directory-panel"><div className="directory-tools"><label className="search-box"><Search size={16} /><input placeholder="Search borrower, loan ID..." value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>⌘ K</kbd></label><div className="filter-buttons"><Filter size={15} />{['All', 'Due today', 'Overdue', 'Paid off'].map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div><ExportButtons exportCsv={exportCsv} exportExcel={exportExcel} /></div><div className="table-scroll"><table><thead><tr><th>BORROWER</th><th>LOAN ID / TYPE</th><th>DISBURSED VIA / STAGE</th><th>PRINCIPAL</th><th>COLLECTED</th><th>OUTSTANDING</th><th>NEXT DUE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{loans.map((loan) => <tr key={loan.id}><td><BorrowerCell loan={loan} /></td><td><b className="loan-id">{loan.id}</b><small className="type-label">{loan.type} loan</small></td><td><span className="mode-chip">{loan.disbursementStage || loan.disbursement?.mode || 'Recorded loan'}</span>{loan.disbursement?.utr && <small className="type-label">{loan.disbursement.utr}</small>}</td><td>{money(loan.principal)}</td><td>{money(loan.paid)}</td><td><b>{money(Math.max(0, loan.principal - loan.paid))}</b></td><td><span className={`due-label ${loan.status.startsWith('Overdue') ? 'overdue-label' : ''}`}>{loan.due}</span></td><td><StatusBadge status={loan.status} /></td><td><div className="ledger-actions"><button className="row-action" onClick={() => openPayment(loan)} disabled={!isCapitalizedLoan(loan)} title={!isCapitalizedLoan(loan) ? 'Available after disbursement' : 'Record a collection'}>{isCapitalizedLoan(loan) ? 'Collect' : 'Not active'} {isCapitalizedLoan(loan) && <ArrowRight size={13} />}</button><button className="icon-button table-more" aria-label={`More actions for ${loan.name}`} onClick={() => { setSelected(loan); setModal('details') }}><MoreHorizontal size={18} /></button></div></td></tr>)}</tbody></table>{loans.length === 0 && <div className="empty-state"><Search size={25} /><b>No loans found</b><span>Try a different search or filter.</span></div>}</div><div className="table-footer"><span>Showing {loans.length} loans</span><ExportButtons exportCsv={exportCsv} exportExcel={exportExcel} /></div></section>
    {title !== 'Collections' && <section className="extra-actions"><button onClick={() => openReminder(loans[0])}><ArrowRight size={14} /> Send upcoming reminder</button><span>WhatsApp messages open in a new tab.</span></section>}
  </>
}

function Reports({ loans, exportCsv, exportExcel }) {
  const total = loans.reduce((sum, loan) => sum + loan.paid, 0)
  const interest = loans.reduce((sum, loan) => sum + (loan.interestPaid || 0), 0)
  return <><PageHeading eyebrow="INSIGHTS & AUDIT" title="Reports & audit" subtitle="A transparent view of portfolio performance and activity." action={<ExportButtons exportCsv={exportCsv} exportExcel={exportExcel} />} /><section className="report-summary"><div><span>Principal collected</span><b>{money(total)}</b><small>Across {loans.length} recorded loans</small></div><div><span>Interest earned</span><b>{money(interest)}</b><small>Based on recorded collections</small></div><div><span>Outstanding principal</span><b>{money(loans.reduce((sum, loan) => sum + (isCapitalizedLoan(loan) ? Math.max(0, loan.principal - loan.paid) : 0), 0))}</b><small>{loans.filter((loan) => loan.status.startsWith('Overdue')).length} accounts overdue</small></div></section><section className="panel audit-panel"><div className="panel-header"><div><div className="section-kicker">AUDIT TRAIL</div><h2>Recent account activity</h2></div><ExportButtons exportCsv={exportCsv} exportExcel={exportExcel} /></div><div className="audit-list">{[{ icon: CheckCircle2, title: 'Collection received', detail: 'Priya Sharma · LN-2408 · Cash', time: 'Today, 10:42 AM', tone: 'green' }, { icon: Plus, title: 'New loan originated', detail: 'Ramesh Patel · Gold loan · ₹1,80,000', time: 'Today, 9:15 AM', tone: 'violet' }, { icon: Bell, title: 'Payment reminder sent', detail: 'Ananya Desai · WhatsApp', time: 'Yesterday, 4:26 PM', tone: 'amber' }, { icon: CheckCircle2, title: 'Loan paid off', detail: 'Meera Iyer · LN-2404', time: 'Yesterday, 12:05 PM', tone: 'green' }].map(({ icon: Icon, title, detail, time, tone }) => <div className="audit-row" key={title}><div className={`audit-icon ${tone}`}><Icon size={16} /></div><div><b>{title}</b><span>{detail}</span></div><small>{time}</small></div>)}</div></section></>
}

function Modal({ title, eyebrow, onClose, wide, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><div className="modal-body">{children}</div></section></div>
}
function ExportButtons({ exportCsv, exportExcel }) {
  return <div className="export-tools"><button className="secondary-button" onClick={exportCsv}><Download size={14} /> CSV</button><button className="secondary-button" onClick={exportExcel}><Download size={14} /> Excel</button></div>
}
function BorrowerCell({ loan }) {
  return <div className="borrower-cell"><div className={`borrower-avatar avatar-${loan.name.charCodeAt(0) % 5}`}>{loan.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><b>{loan.name}</b><small>{loan.phone.replace(/^(\d{2})(\d{5})(\d{5})$/, '+$1 $2 $3')}</small></div></div>
}
function RiskBadge({ risk }) {
  return <span className={`risk-pill ${risk === 'High risk' ? 'high' : risk === 'Moderate' ? 'medium' : 'low'}`}><i />{risk}</span>
}
function StatusBadge({ status }) {
  const tone = status.startsWith('Overdue') ? 'status-overdue' : status === 'Paid off' || status === 'Paid' ? 'status-paid' : status === 'Due today' ? 'status-due' : ['Processing', 'Under review', 'Payment pending'].includes(status) || status.startsWith('Active ·') ? 'status-processing' : ['Approved', 'Sanctioned'].includes(status) ? 'status-approved' : 'status-upcoming'
  return <span className={`status-badge ${tone}`}><i />{status}</span>
}

export default App
