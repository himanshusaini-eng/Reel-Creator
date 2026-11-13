import { BadRequestException, Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { AuthedRequest } from "../auth/user.decorator";
import { SupportService, type Ticket } from "./support.service";

@Controller("api/support")
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post("contact")
  @HttpCode(200)
  contact(@Body() body: Record<string, string>, @Req() req: AuthedRequest) {
    return this.take("contact", body, req);
  }

  @Post("bug")
  @HttpCode(200)
  bug(@Body() body: Record<string, string>, @Req() req: AuthedRequest) {
    return this.take("bug", body, req);
  }

  @Post("feature")
  @HttpCode(200)
  feature(@Body() body: Record<string, string>, @Req() req: AuthedRequest) {
    return this.take("feature", body, req);
  }

  @Post("newsletter")
  @HttpCode(200)
  newsletter(@Body() body: Record<string, string>) {
    return this.take("newsletter", body);
  }

  @Post("early-access")
  @HttpCode(200)
  earlyAccess(@Body() body: Record<string, string>) {
    return this.take("early_access", body);
  }

  private take(kind: Ticket["kind"], body: Record<string, string>, req?: AuthedRequest) {
    try {
      return this.support.submit({
        kind,
        name: body?.name,
        email: body?.email || req?.user?.email,
        topic: body?.topic || body?.title,
        message: body?.message,
        company: body?.company,
        userId: req?.user?.id || null,
      });
    } catch (error) {
      throw new BadRequestException({ error: (error as Error).message });
    }
  }
}
