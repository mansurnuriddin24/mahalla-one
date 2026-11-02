export type UserRole = 'CITIZEN' | 'CHAIRMAN' | 'STAFF' | 'DISTRICT_ADMIN' | 'SUPER_ADMIN';

export type ComplaintStatus = 'NEW' | 'ACCEPTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'CLOSED';

export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  uid: string;
  phone: string | null;
  email: string | null;
  fullName: string;
  role: UserRole;
  regionId: string | null;
  districtId: string | null;
  neighborhoodId: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Region {
  id: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameKaa: string;
  createdAt: string;
}

export interface District {
  id: string;
  regionId: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameKaa: string;
  createdAt: string;
}

export interface Neighborhood {
  id: string;
  districtId: string;
  code: string;
  nameUz: string;
  nameRu: string;
  nameKaa: string;
  chairmanName: string | null;
  phone: string | null;
  address: string | null;
  coordinatesLat: number | null;
  coordinatesLng: number | null;
  subscriptionStatus: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  complaintCode: string;
  title: string;
  description: string;
  category: string;
  regionId: string | null;
  districtId: string | null;
  neighborhoodId: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  citizenId: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  duplicateOfId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  citizen?: User;
  neighborhood?: Neighborhood;
  media?: ComplaintMedia[];
  history?: ComplaintHistoryItem[];
  assignments?: Assignment[];
  rating?: Rating;
}

export interface ComplaintMedia {
  id: string;
  complaintId: string;
  fileUrl: string;
  fileType: string;
  caption: string | null;
  createdAt: string;
}

export interface ComplaintHistoryItem {
  id: string;
  complaintId: string;
  previousStatus: string | null;
  newStatus: string;
  responsibleUserId: string | null;
  explanation: string;
  evidenceUrl: string | null;
  createdAt: string;
}

export interface Assignment {
  id: string;
  complaintId: string;
  staffId: string;
  assignedById: string;
  notes: string | null;
  status: string;
  deadline: string | null;
  createdAt: string;
}

export interface Announcement {
  id: string;
  neighborhoodId: string;
  title: string;
  content: string;
  targetAudience: string;
  isPublished: boolean;
  publishedAt: string;
  viewCount: number;
  createdAt: string;
}

export interface PollOption {
  id: string;
  pollId: string;
  optionText: string;
  voteCount: number;
}

export interface Poll {
  id: string;
  neighborhoodId: string;
  question: string;
  isActive: boolean;
  closingDate: string | null;
  createdAt: string;
  options?: PollOption[];
  hasVoted?: boolean;
  votedOptionId?: string | null;
}

export interface Rating {
  id: string;
  complaintId: string;
  citizenId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  priceUzs: number;
  billingInterval: string;
  description: string;
  features: string;
}

export interface ReportSummary {
  total: number;
  resolved: number;
  inProgress: number;
  newComplaints: number;
  rejected: number;
  resolutionRate: number;
  averageResolutionHours: number;
}
