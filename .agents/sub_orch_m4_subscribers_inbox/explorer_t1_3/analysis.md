# Task 1 Analysis: True Pagination & Tags (Endpoint & UI Tag Management)

## Executive Summary
This analysis details the design and implementation strategy for true server-side pagination, search, and multi-criteria filtering (tags/platforms) for subscriber profiles. It outlines the schema adjustments to explicitly track communication channels, details route ordering constraints in NestJS to prevent conflicts, and designs an interactive Arabic RTL tag management and pagination UI for the Next.js frontend while guaranteeing backward compatibility.

---

## 1. Problem Boundary & Objectives
1. **Server-Side Pagination & Filters**: Replace the current mock frontend pagination with actual backend limit/offset paging and filter parameters.
2. **Backward-Compatibility**: The `/subscribers` GET endpoint must return a plain array (`Subscriber[]`) when page/limit parameters are omitted, satisfying existing E2E tests, but return a paginated metadata object (`{ data, total, page, limit, totalPages }`) when they are provided.
3. **Platform Tracking (No Guess Heuristics)**: Introduce an explicit `platform` field to the `Subscriber` model, update webhook subscriber creation to record it, and fallback gracefully for legacy records.
4. **Tag Management**: Support listing all unique tags for filters, and build dedicated backend routes and a frontend dialog to assign/remove tags on subscribers.

---

## 2. Backend Architecture Details

### A. Database Schema Adjustments (`backend/prisma/schema.prisma`)
Add a nullable `platform` field to the `Subscriber` model to explicitly track the source channel.

```prisma
model Subscriber {
  id        String   @id @default(uuid())
  tenantId  String
  name      String?
  phone     String?
  email     String?
  tags      String[]
  platform  String?  // <-- Added field for Platform tracking (e.g., WHATSAPP, FACEBOOK_PAGE, INSTAGRAM)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}
```
*Migration Requirement*: Run `npx prisma migrate dev --name add_subscriber_platform` in the `backend/` directory to generate the SQL migration and update the local database.

### B. Webhooks Integration (`backend/src/webhooks/webhooks.service.ts`)
Update WhatsApp message processing so that automatically-created subscribers explicitly record `'WHATSAPP'` as their platform:
```typescript
// Line 158: Update WhatsApp subscriber creation
subscriber = await this.prisma.subscriber.create({
  data: {
    tenantId: connection.tenantId,
    name: senderName,
    phone: senderId,
    tags: [],
    platform: 'WHATSAPP', // Explicit platform recording
  },
});
```

### C. DTO Updates (`backend/src/subscribers/dto/subscribers.dto.ts`)
Add the optional `platform` field to `CreateSubscriberDto` and `UpdateSubscriberDto` to allow manual creations/updates:
```typescript
// Add to CreateSubscriberDto and UpdateSubscriberDto
@IsOptional()
@IsString()
platform?: string;
```

### E. Service Layer Pagination & Filtering (`backend/src/subscribers/subscribers.service.ts`)
Refactor the `findAll` service method. Use a fallback heuristic to classify legacy records where `platform` is `null` (matching the frontend's original classification):
```typescript
async findAll(
  tenantId: string,
  params: {
    search?: string;
    page?: number;
    limit?: number;
    tag?: string;
    platform?: string;
  },
) {
  const { search, page, limit, tag, platform } = params;
  const where: any = { tenantId };
  const andConditions: any[] = [];

  // 1. Search Query
  if (search && search.trim() !== '') {
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql://');
    const mode = isPostgres ? 'insensitive' : undefined;
    andConditions.push({
      OR: [
        { name: { contains: search, mode } },
        { email: { contains: search, mode } },
        { phone: { contains: search, mode } },
        { notes: { contains: search, mode } },
        { tags: { has: search } },
      ],
    });
  }

  // 2. Tag Filter
  if (tag && tag.trim() !== '' && tag !== 'ALL') {
    andConditions.push({ tags: { has: tag } });
  }

  // 3. Platform Filter (supporting legacy/null fallbacks)
  if (platform && platform.trim() !== '' && platform !== 'ALL') {
    if (platform === 'WHATSAPP') {
      andConditions.push({
        OR: [
          { platform: 'WHATSAPP' },
          { platform: null, phone: { not: null } },
        ],
      });
    } else if (platform === 'FACEBOOK_PAGE' || platform === 'FACEBOOK') {
      andConditions.push({
        OR: [
          { platform: 'FACEBOOK_PAGE' },
          { platform: 'FACEBOOK' },
          { platform: null, phone: null, email: { not: null } },
        ],
      });
    } else if (platform === 'INSTAGRAM') {
      andConditions.push({
        OR: [
          { platform: 'INSTAGRAM' },
          { platform: null, phone: null, email: null },
        ],
      });
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  // 4. Server-side Pagination
  if (page !== undefined || limit !== undefined) {
    const parsedPage = Math.max(1, page || 1);
    const parsedLimit = Math.max(1, limit || 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const [total, data] = await Promise.all([
      this.prisma.subscriber.count({ where }),
      this.prisma.subscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parsedLimit,
      }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);

    return {
      data,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages,
    };
  }

  // 5. Plain Array Fallback (Backward-Compatibility)
  return this.prisma.subscriber.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}
```

Add helper methods for tag management and global tag list fetching:
```typescript
async getAllTags(tenantId: string): Promise<string[]> {
  const subscribers = await this.prisma.subscriber.findMany({
    where: { tenantId },
    select: { tags: true },
  });
  const uniqueTags = new Set<string>();
  for (const sub of subscribers) {
    for (const tag of sub.tags) {
      uniqueTags.add(tag);
    }
  }
  return Array.from(uniqueTags);
}

async addTag(tenantId: string, id: string, tag: string) {
  const subscriber = await this.findOne(tenantId, id);
  if (subscriber.tags.includes(tag)) {
    return subscriber;
  }
  return this.prisma.subscriber.update({
    where: { id },
    data: {
      tags: {
        set: Array.from(new Set([...subscriber.tags, tag])),
      },
    },
  });
}

async removeTag(tenantId: string, id: string, tag: string) {
  const subscriber = await this.findOne(tenantId, id);
  if (!subscriber.tags.includes(tag)) {
    return subscriber;
  }
  return this.prisma.subscriber.update({
    where: { id },
    data: {
      tags: {
        set: subscriber.tags.filter((t) => t !== tag),
      },
    },
  });
}
```

### E. Controller & Route Ordering Gotcha (`backend/src/subscribers/subscribers.controller.ts`)
**IMPORTANT NESTJS GOTCHA**: The route `GET /subscribers/tags` MUST be declared BEFORE the generic `GET /subscribers/:id` endpoint. If it is declared after, NestJS will parse `/subscribers/tags` as a subscriber UUID lookup, leading to `404/500` errors.

```typescript
@UseGuards(JwtAuthGuard)
@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateSubscriberDto) {
    return this.subscribersService.create(req.user.tenantId, dto);
  }

  // 1. MUST BE BEFORE GET :id
  @Get('tags')
  async getAllTags(@Request() req: any) {
    return this.subscribersService.getAllTags(req.user.tenantId);
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tag') tag?: string,
    @Query('platform') platform?: string,
  ) {
    const pageNum = page && !isNaN(parseInt(page, 10)) ? parseInt(page, 10) : undefined;
    const limitNum = limit && !isNaN(parseInt(limit, 10)) ? parseInt(limit, 10) : undefined;

    return this.subscribersService.findAll(req.user.tenantId, {
      search,
      page: pageNum,
      limit: limitNum,
      tag,
      platform,
    });
  }

  @Get(':id')
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.subscribersService.findOne(req.user.tenantId, id);
  }

  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriberDto,
  ) {
    return this.subscribersService.update(req.user.tenantId, id, dto);
  }

  @Post(':id/tags')
  async addTag(
    @Request() req: any,
    @Param('id') id: string,
    @Body('tag') tag: string,
  ) {
    return this.subscribersService.addTag(req.user.tenantId, id, tag);
  }

  @Delete(':id/tags/:tag')
  async removeTag(
    @Request() req: any,
    @Param('id') id: string,
    @Param('tag') tag: string,
  ) {
    return this.subscribersService.removeTag(req.user.tenantId, id, tag);
  }

  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.subscribersService.remove(req.user.tenantId, id);
  }
}
```

---

## 3. Frontend Architecture Details (`frontend/src/app/dashboard/subscribers/page.tsx`)

### A. State Management Overhaul
Declare states to drive API requests, track metadata, and support filtering/tag actions:
```typescript
const [searchQuery, setSearchQuery] = useState("")
const [subscribersList, setSubscribersList] = useState<any[]>([])
const [isLoading, setIsLoading] = useState(true)

// Pagination state
const [page, setPage] = useState(1)
const [limit, setLimit] = useState(10)
const [totalPages, setTotalPages] = useState(1)
const [totalCount, setTotalCount] = useState(0)

// Filtering state
const [selectedTag, setSelectedTag] = useState("")
const [selectedPlatform, setSelectedPlatform] = useState("")
const [availableTags, setAvailableTags] = useState<string[]>([])

// Tag Dialog editing state
const [isTagDialogOpen, setIsTagDialogOpen] = useState(false)
const [editingSubscriber, setEditingSubscriber] = useState<any>(null)
const [newTagInput, setNewTagInput] = useState("")
```

### B. Dynamic Platform Detection & Imports
Import UI components and ensure platform detection matches the explicit database value first:
```typescript
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Filter, Download, User, MessageCircle, Globe, Camera, Users, ChevronRight, ChevronLeft, Plus, X, Tag } from "lucide-react"

const getPlatformDetails = (sub: any) => {
  const platformVal = sub.platform;
  if (platformVal === 'WHATSAPP') {
    return { name: "واتساب", icon: MessageCircle, color: "text-[#25D366]", bgColor: "bg-[#25D366]/10" }
  } else if (platformVal === 'FACEBOOK_PAGE' || platformVal === 'FACEBOOK') {
    return { name: "فيسبوك", icon: Globe, color: "text-[#1877F2]", bgColor: "bg-[#1877F2]/10" }
  } else if (platformVal === 'INSTAGRAM') {
    return { name: "انستغرام", icon: Camera, color: "text-[#E1306C]", bgColor: "bg-[#E1306C]/10" }
  }
  
  // Fallback guess heuristics for backward compatibility
  if (sub.phone) {
    return { name: "واتساب", icon: MessageCircle, color: "text-[#25D366]", bgColor: "bg-[#25D366]/10" }
  } else if (sub.email) {
    return { name: "فيسبوك", icon: Globe, color: "text-[#1877F2]", bgColor: "bg-[#1877F2]/10" }
  } else {
    return { name: "انستغرام", icon: Camera, color: "text-[#E1306C]", bgColor: "bg-[#E1306C]/10" }
  }
}
```

### C. Data Synchronization Hooks
Run queries on filter, pagination, or search change:
```typescript
const fetchSubscribers = async () => {
  try {
    setIsLoading(true)
    const params = new URLSearchParams()
    if (searchQuery) params.append("search", searchQuery)
    params.append("page", String(page))
    params.append("limit", String(limit))
    if (selectedTag) params.append("tag", selectedTag)
    if (selectedPlatform) params.append("platform", selectedPlatform)

    const res = await api.get(`/subscribers?${params.toString()}`)
    if (res.data && res.data.data) {
      setSubscribersList(res.data.data)
      setTotalPages(res.data.totalPages || 1)
      setTotalCount(res.data.total || 0)
    } else {
      // Fallback in case of array returns
      setSubscribersList(res.data || [])
      setTotalCount(res.data?.length || 0)
      setTotalPages(1)
    }
  } catch (err) {
    console.error("Error fetching subscribers:", err)
  } finally {
    setIsLoading(false)
  }
}

const fetchTags = async () => {
  try {
    const res = await api.get("/subscribers/tags")
    setAvailableTags(res.data || [])
  } catch (err) {
    console.error("Error fetching tags:", err)
  }
}

// Initial mount load
useEffect(() => {
  fetchTags()
}, [])

// Debounced search / change hook
useEffect(() => {
  const delayDebounceFn = setTimeout(() => {
    fetchSubscribers()
  }, 300)

  return () => clearTimeout(delayDebounceFn)
}, [searchQuery, page, limit, selectedTag, selectedPlatform])
```

### D. Table Header Dropdown Controls
Place these in `CardHeader` to filter by platform and tags:
```typescript
<CardHeader className="pb-4 border-b border-border/50">
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
    <div className="relative max-w-sm w-full">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input 
        type="text" 
        placeholder="ابحث بالاسم، الرقم، أو البريد الإلكتروني..." 
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
        className="pl-4 pr-10 rounded-xl h-11"
      />
    </div>
    <div className="flex items-center gap-3 flex-wrap">
      {/* Platform Filter */}
      <Select value={selectedPlatform || "ALL"} onValueChange={(val) => { setSelectedPlatform(val === 'ALL' ? '' : val); setPage(1); }}>
        <SelectTrigger className="w-[150px] rounded-xl h-11 border-border/50 bg-background text-right">
          <SelectValue placeholder="المنصة (كلها)" />
        </SelectTrigger>
        <SelectContent className="bg-[#0a0a0f] border-border text-white text-right">
          <SelectItem value="ALL">جميع المنصات</SelectItem>
          <SelectItem value="FACEBOOK_PAGE">فيسبوك</SelectItem>
          <SelectItem value="INSTAGRAM">انستغرام</SelectItem>
          <SelectItem value="WHATSAPP">واتساب</SelectItem>
        </SelectContent>
      </Select>

      {/* Tag Filter */}
      <Select value={selectedTag || "ALL"} onValueChange={(val) => { setSelectedTag(val === 'ALL' ? '' : val); setPage(1); }}>
        <SelectTrigger className="w-[150px] rounded-xl h-11 border-border/50 bg-background text-right">
          <SelectValue placeholder="الوسم (كلها)" />
        </SelectTrigger>
        <SelectContent className="bg-[#0a0a0f] border-border text-white text-right">
          <SelectItem value="ALL">جميع الوسوم</SelectItem>
          {availableTags.map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
</CardHeader>
```

### E. Tag Dialog & Edit UI
Embed the dialog under the main page layout container:
```typescript
{/* Tag Editor Dialog */}
<Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
  <DialogContent className="sm:max-w-[425px] bg-[#0a0a0f] border-border text-white rounded-xl">
    <DialogHeader>
      <DialogTitle className="text-xl font-black text-right">إدارة الوسوم</DialogTitle>
      <DialogDescription className="text-muted-foreground text-right mt-1">
        إضافة أو إزالة الوسوم للمشترك <span className="text-primary font-bold">{editingSubscriber?.name || "مشترك"}</span>
      </DialogDescription>
    </DialogHeader>
    <div className="flex flex-col gap-4 py-4">
      {/* Current Tags */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-muted-foreground text-right font-bold">الوسوم الحالية</label>
        <div className="flex flex-wrap gap-1.5 min-h-[40px] p-3 rounded-xl border border-border/50 bg-black/20">
          {editingSubscriber?.tags && editingSubscriber.tags.length > 0 ? (
            editingSubscriber.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="font-bold rounded-lg text-xs gap-1.5 bg-accent text-foreground hover:bg-accent">
                {tag}
                <button
                  onClick={async () => {
                    try {
                      await api.delete(`/subscribers/${editingSubscriber.id}/tags/${encodeURIComponent(tag)}`);
                      setEditingSubscriber((prev: any) => ({
                        ...prev,
                        tags: prev.tags.filter((t: string) => t !== tag)
                      }));
                      fetchSubscribers();
                      fetchTags();
                    } catch (err) {
                      console.error("Error removing tag:", err);
                    }
                  }}
                  className="rounded-full hover:bg-foreground/10 p-0.5"
                >
                  <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground py-1">لا توجد وسوم حالياً</span>
          )}
        </div>
      </div>

      {/* Add New Tag */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-muted-foreground text-right font-bold">إضافة وسم جديد</label>
        <div className="flex gap-2 direction-rtl">
          <Input
            type="text"
            placeholder="اسم الوسم..."
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!newTagInput.trim()) return;
                try {
                  await api.post(`/subscribers/${editingSubscriber.id}/tags`, { tag: newTagInput.trim() });
                  setEditingSubscriber((prev: any) => ({
                    ...prev,
                    tags: Array.from(new Set([...prev.tags, newTagInput.trim()]))
                  }));
                  setNewTagInput("");
                  fetchSubscribers();
                  fetchTags();
                } catch (err) {
                  console.error("Error adding tag:", err);
                }
              }
            }}
            className="rounded-xl h-11 text-right"
          />
          <Button
            onClick={async () => {
              if (!newTagInput.trim()) return;
              try {
                await api.post(`/subscribers/${editingSubscriber.id}/tags`, { tag: newTagInput.trim() });
                setEditingSubscriber((prev: any) => ({
                  ...prev,
                  tags: Array.from(new Set([...prev.tags, newTagInput.trim()]))
                }));
                setNewTagInput("");
                fetchSubscribers();
                fetchTags();
              } catch (err) {
                console.error("Error adding tag:", err);
              }
            }}
            className="rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-4 shrink-0"
          >
            إضافة
          </Button>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

### F. Dynamic Pagination Footer UI
Overhaul the pagination row at the bottom of the table:
```typescript
{/* Pagination */}
<div className="p-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
  <div className="font-medium">
    إظهار {totalCount > 0 ? (page - 1) * limit + 1 : 0} إلى {Math.min(page * limit, totalCount)} من أصل {totalCount.toLocaleString('ar-EG')} مشترك
  </div>
  
  <div className="flex items-center gap-4 flex-wrap">
    {/* Page size select dropdown */}
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium">عدد الأسطر:</span>
      <Select value={String(limit)} onValueChange={(val) => { setLimit(Number(val)); setPage(1); }}>
        <SelectTrigger className="w-[80px] h-9 rounded-lg text-xs border-border/50 bg-background">
          <SelectValue placeholder={String(limit)} />
        </SelectTrigger>
        <SelectContent className="bg-[#0a0a0f] border-border text-white">
          <SelectItem value="5">٥</SelectItem>
          <SelectItem value="10">١٠</SelectItem>
          <SelectItem value="20">٢٠</SelectItem>
          <SelectItem value="50">٥٠</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Navigation buttons */}
    <div className="flex items-center gap-1">
      <button 
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={page === 1}
        className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      
      {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
        <button
          key={pageNum}
          onClick={() => setPage(pageNum)}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all duration-200 cursor-pointer ${
            page === pageNum
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-accent border border-border/30"
          }`}
        >
          {pageNum.toLocaleString('ar-EG')}
        </button>
      ))}
      
      <button 
        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
        disabled={page >= totalPages}
        className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
    </div>
  </div>
</div>
```

---

## 5. Step-by-Step Strategy for Worker Subagent

### Phase 1: Database Migration
1. Update `backend/prisma/schema.prisma` to add `platform String?` to the `Subscriber` model.
2. Run `npx prisma migrate dev --name add_subscriber_platform` in `backend/` directory to generate and apply the schema changes.
3. Ensure the prisma client is regenerated (`npx prisma generate`).

### Phase 2: Backend Controller & Service Changes
1. Modify `backend/src/subscribers/dto/subscribers.dto.ts` to add validation for optional `platform` parameter in `CreateSubscriberDto` and `UpdateSubscriberDto`.
2. Update `backend/src/subscribers/subscribers.service.ts` to support pagination (`page`/`limit`) and platform/tag filter parameters in `findAll`.
3. Introduce route ordering and helper methods (`getAllTags`, `addTag`, `removeTag`) in the service.
4. Modify `backend/src/subscribers/subscribers.controller.ts` with correct endpoint routing ordering: `tags` route BEFORE `:id` route.
5. In `backend/src/webhooks/webhooks.service.ts`, append `'WHATSAPP'` platform value when creating new subscribers from WhatsApp incoming DMs.

### Phase 3: Frontend Integration & Dropdowns
1. Modify `frontend/src/app/dashboard/subscribers/page.tsx`. Import `@/components/ui/select` and `@/components/ui/dialog` components.
2. Set up the states for pagination (`page`, `limit`, `totalPages`, `totalCount`), filters (`selectedTag`, `selectedPlatform`), and available tags.
3. Replace the static filter button with platform and tags `Select` dropdown components.
4. Call `api.get('/subscribers/tags')` in `useEffect` on mount to populate tags.
5. Update `fetchSubscribers` to serialize the pagination and filter values in `URLSearchParams`.

### Phase 4: Frontend Actions & Footer Dialog
1. Add tag manager modal/dialog UI using `@/components/ui/dialog` at the bottom of the page.
2. In the table tags column, render a badge list along with a Plus (`+`) button to trigger the dialog for adding/deleting tags.
3. Bind dialog tag list actions to `/subscribers/:id/tags` (POST) and `/subscribers/:id/tags/:tag` (DELETE) calls.
4. Overhaul the pagination row to display dynamic showing index range, pagination controls (Previous, Next, pages), and page size Select dropdown.

### Phase 5: Verification & Quality Assurance
1. Run backend tests to verify compatibility: `npm run test:e2e -- test/inbox.e2e-spec.ts`.
2. Inspect the UI layout to verify Tajawal Arabic RTL layout compatibility (`ChevronRight` goes forward, `ChevronLeft` goes backward, right alignment is correct).
3. Verify that visual theme rules are met: primary backgrounds are dark, accents are teal/cyan (`#0ff5d4`/`#00e5ff`), and absolutely zero violet or purple classes/colors are present.
