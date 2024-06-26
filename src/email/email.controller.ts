import { Controller, Global } from '@nestjs/common';
import { EmailService } from './email.service';


@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}
}
