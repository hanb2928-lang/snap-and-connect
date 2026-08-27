export interface ContactInfo {
  type: string;
  label: string;
  value: string;
  action?: string;
}

export interface ShoppingMatch {
  platform: string;
  productName: string;
  price: string;
  url: string;
}

export interface AffiliateLink {
  platform: string;
  label: string;
  url: string;
}

export interface CustomAffiliateLink {
  platform: string;
  label: string;
  url: string;
  productIndex: number;
}

export type PlatformKey = 'naverBlog' | 'shortform' | 'twitter' | 'instagram' | 'threads' | 'pinterest' | 'smartstore';

export interface PlatformVariant {
  hook: string;
  caption: string;
  hashtags: string[];
  cardStyle: 'magazine' | 'bold' | 'minimal' | 'feed';
}

export interface TemplateData {
  priceLabel: string;
  oneLiner: string;
  category: string;
  accentColor: string;
  hook: string;
  hashtags: string[];
  productAdvantages: string[];
  caption: string;
  platformVariants?: Record<PlatformKey, PlatformVariant>;
}

export interface CustomReview {
  text: string;
  rating: number;
  updatedAt: string;
}

export interface LocalStoreInfo {
  enabled: boolean;
  storeName: string;
  address: string;
  region: string;
  phone: string;
  todayOffer: string;
}

export interface Scan {
  id: string;
  image_url: string;
  title: string | null;
  summary: string | null;
  contacts: ContactInfo[];
  tags: string[];
  created_at: string;
  product_name: string | null;
  product_category: string | null;
  price_estimate: string | null;
  one_liner: string | null;
  shopping_matches: ShoppingMatch[];
  affiliate_links: AffiliateLink[];
  custom_affiliate_links: CustomAffiliateLink[];
  template_data: TemplateData;
  detected_products: DetectedProduct[];
  edited_image_url?: string | null;
  additional_image_urls?: string[] | null;
  custom_review?: CustomReview | null;
  local_store_info?: LocalStoreInfo | null;
  scan_source?: 'single' | 'multi' | 'template' | null;
  tts_url?: string | null;
}

export interface DetectedProduct {
  id: string;
  productName: string;
  productCategory: string;
  priceEstimate: string;
  oneLiner: string;
  shoppingMatches: ShoppingMatch[];
  templateData: TemplateData;
}

export interface AnalysisResult {
  title: string;
  summary: string;
  contacts: ContactInfo[];
  tags: string[];
  productName: string;
  productCategory: string;
  priceEstimate: string;
  oneLiner: string;
  shoppingMatches: ShoppingMatch[];
  templateData: TemplateData;
  detectedProducts: DetectedProduct[];
}

export interface UserSettings {
  coupang_partners_id: string | null;
  naver_shopping_id: string | null;
  toss_share_id: string | null;
  openai_api_key: string | null;
  logo_url: string | null;
  default_video_duration: string | null;
  default_tts_voice: string | null;
  auto_disclosure: boolean | null;
  brand_persona: string | null;
}

export interface SavedAsset {
  id: string;
  scan_id: string | null;
  asset_type: 'image' | 'video';
  title: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  thumbnail_url: string | null;
  platform: string | null;
  affiliate_platform: string | null;
  created_at: string;
}

export interface RevenueRecord {
  id: string;
  platform: string;
  amount: number;
  period_month: string;
  note: string | null;
  created_at: string;
  scan_id: string | null;
}

export interface ShortLinkWithClicks {
  slug: string;
  destination_url: string;
  click_count: number;
  last_clicked_at: string | null;
}
