import { Injectable } from '@nestjs/common';
import { createTransport, Transporter} from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { log } from 'console';

@Injectable()
export class EmailService {
  transporter: Transporter

  constructor(private configService: ConfigService){
    
    this.transporter = createTransport({
      host: this.configService.get('nodemailer_host'),
      port: this.configService.get('nodemailer_port'),
      secure: false,
      auth: {
        user: this.configService.get('nodemailer_auth_user'),
        pass: this.configService.get('nodemailer_auth_pass')
      }
    })
  }

  async sendMail({ to, subject, html }) {
    await this.transporter.sendMail({
      from: {
        name: 'AZL的大Dio',
        address: this.configService.get('nodemailer_auth_user')
      },
      to,
      subject,
      html
    });

  }
}
