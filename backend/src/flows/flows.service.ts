import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaveFlowDto } from './dto/flows.dto';

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async getFlows(tenantId: string) {
    return this.prisma.flow.findMany({
      where: { tenantId },
      include: {
        triggers: true,
        steps: {
          include: {
            branches: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFlow(id: string, tenantId: string) {
    const flow = await this.prisma.flow.findFirst({
      where: { id, tenantId },
      include: {
        triggers: true,
        steps: {
          include: {
            branches: true,
          },
        },
      },
    });
    if (!flow) {
      throw new NotFoundException('Flow not found');
    }
    return flow;
  }

  async saveFlow(id: string | undefined, tenantId: string, dto: SaveFlowDto) {
    return this.prisma.$transaction(async (tx) => {
      let flow;
      if (id) {
        flow = await tx.flow.findFirst({
          where: { id, tenantId },
        });
        if (!flow) {
          throw new NotFoundException('Flow not found');
        }
        flow = await tx.flow.update({
          where: { id },
          data: {
            name: dto.name,
            description: dto.description,
            isActive: dto.isActive ?? flow.isActive,
          },
        });
      } else {
        flow = await tx.flow.create({
          data: {
            tenantId,
            name: dto.name,
            description: dto.description,
            isActive: dto.isActive ?? false,
          },
        });
      }

      // Delete old triggers and steps (branches are cascade deleted with steps)
      await tx.flowTrigger.deleteMany({
        where: { flowId: flow.id },
      });

      await tx.flowStep.deleteMany({
        where: { flowId: flow.id },
      });

      // Create new triggers
      if (dto.triggers && dto.triggers.length > 0) {
        await tx.flowTrigger.createMany({
          data: dto.triggers.map((t) => ({
            flowId: flow.id,
            type: t.type,
            configuration: t.configuration ?? {},
          })),
        });
      }

      // Create new steps and branches
      if (dto.steps && dto.steps.length > 0) {
        for (const stepDto of dto.steps) {
          const stepId = stepDto.id;
          await tx.flowStep.create({
            data: {
              id: stepId,
              flowId: flow.id,
              type: stepDto.type,
              configuration: stepDto.configuration ?? {},
              metadata: stepDto.metadata ?? {},
            },
          });

          if (stepDto.branches && stepDto.branches.length > 0) {
            await tx.flowBranch.createMany({
              data: stepDto.branches.map((b) => ({
                id: b.id,
                stepId: stepId,
                label: b.label,
                condition: b.condition ?? {},
                nextStepId: b.nextStepId || null,
              })),
            });
          }
        }
      }

      // Return fully updated flow
      return tx.flow.findFirst({
        where: { id: flow.id },
        include: {
          triggers: true,
          steps: {
            include: {
              branches: true,
            },
          },
        },
      });
    });
  }

  async toggleActive(id: string, tenantId: string, isActive: boolean) {
    const flow = await this.prisma.flow.findFirst({
      where: { id, tenantId },
    });
    if (!flow) {
      throw new NotFoundException('Flow not found');
    }
    return this.prisma.flow.update({
      where: { id },
      data: { isActive },
    });
  }

  async deleteFlow(id: string, tenantId: string) {
    const flow = await this.prisma.flow.findFirst({
      where: { id, tenantId },
    });
    if (!flow) {
      throw new NotFoundException('Flow not found');
    }
    return this.prisma.flow.delete({
      where: { id },
    });
  }
}
