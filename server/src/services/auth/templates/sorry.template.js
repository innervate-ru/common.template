const header = `
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Fesco</title>

    <!-- inline -->
    <style type="text/css">
        body {
            margin:0;
            border: 0;
            padding:0;
            font-family: Arial, sans-serif;
            -webkit-font-smoothing:antialiased;
            -webkit-text-size-adjust:none;
        }
        table {
            border-spacing: 0;
            border-collapse: collapse;
        }
        td {
            margin:0;
            border: 0;
            padding:0;
        }
        img {
            display: block;
        }

        a {
            color: #369;
        }

        .body-table-wrapper {
            text-align: center;
        }
        .body-table {
            width: 1000px;
            text-align: left;
            font-family: Arial, sans-serif;
        }
        .body-table * {
            font-family: Arial, sans-serif;
        }

        .info-block .info-block-inner,
        .info-mes .info-mes-inner,
        .info-account .info-account-inner,
        .info-table .info-table-inner {
            margin: 30px 20px;
        }
        .info-request .info-request-inner,
        .info-small-mes .info-small-mes-inner {
            margin: 20px;
        }

        .info-links .info-links-inner {
            margin: 20px 20px 30px;
        }

        .info-block .info-block-title,
        .info-mes .info-mes-title,
        .info-account .info-account-title,
        .info-table .info-table-title,
        .info-request .info-request-title,
        .info-small-mes .info-small-mes-title {
            text-transfotm: uppercase;
        }

        .header {
            background-color: #369;
        }
        .header .logo {
            width: 100%;
            height: 62px;
            max-height: 62px;
            text-align: center;
        }
        .header .logo img {
            display: inline;
            width: 166px;
            height: 62px;
            max-height: 62px;
        }
        .sub-header img {
            width: 100%;
        }
        .sub-header {
            text-align: center;
            background-color: #3671ad;
            width: 320px;
        }
        .info-block {
            background: #369;
        }
        .info-block .info-block-title,
        .info-block .info-block-link {
            text-align: center;
            color: #fff;
        }
        .info-block .info-block-title {
            font-size: 30px;
            line-height: 40px;
            font-weight: bold;
        }
        .info-block .info-block-link {
            margin-top: 26px;
            text-align: center;
        }
        .info-block .info-block-link a {
            display: inline-block;
            width: 300px;
            font-size: 15px;
            line-height: 17px;
            font-weight: bold;
            border: 1px solid #fff;
            padding: 12px 15px;
            color: #fff;
            text-decoration: none;
            margin: 0 auto;
            -moz-border-radius: 5px;
            -webkit-border-radius: 5px;
            border-radius: 5px;
        }

        .info-mes {
            background: #fff;
            color: #333;
        }
        .info-mes .info-mes-title {
            color: #333;
            font-size: 24px;
            line-height: 34px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .info-mes .info-mes-content {
            font-size: 14px;
            line-height: 20px;
            margin-bottom: 20px;
        }

        .info-btn {
            display: inline-block;
            padding: 12px 25px;
            color: #ff9933;
            font-size: 20px;
            line-height: 22px;
            font-weight: bold;
            text-decoration: none;
            text-align: center;
            border: 1px solid #ff9933;
            -moz-border-radius: 5px;
            -webkit-border-radius: 5px;
            border-radius: 5px;
        }

        .info-account {
            background: #2f5d8e;
            color: #fff;
        }
        .info-account .info-account-title {
            font-size: 22px;
            line-height: 30px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .info-account .info-account-block {
            font-size: 15px;
            line-height: 30px;
            margin: 0 0 30px;
        }
        .info-account .info-account-block a {
            color: #fff;
        }
        .info-account .info-account-block.last {
            margin-bottom: 0;
        }
        .info-account .info-account-block-text {
            color: #fff;
        }
        .info-account .info-account-link {
            display: inline-block;
            font-size: 24px;
            line-height: 22px;
            padding: 10px 35px;
            color: #fff;
            border: 1px solid #fff;
            text-decoration: none;
            -moz-border-radius: 5px;
            -webkit-border-radius: 5px;
            border-radius: 5px;
        }

        .info-table {
            background: #fff;
            color: #333;
        }
        .info-table .info-table-title {
            color: #333;
            font-size: 22px;
            line-height: 30px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .info-table .info-table-data {
            table-layout: fixed;
            font-size: 14px;
            line-height: 20px;
        }
        .info-table .info-table-data td {
            vertical-align: top;
        }
        .info-table-data .field-name,
        .info-table-data .field-val {
            margin-bottom: 18px;
        }
        .info-table-data .field-name {
            margin-right: 50px;
        }
        .info-table-data .field-name {
            font-weight: bold;
        }
        .info-table-data .field-val.is-nowrap {
            white-space: nowrap;
        }
        .info-table-data .btn {
            display: inline-block;
            margin: 0 10px 10px 0;
            color: #369;
            border: 1px solid #369;
            font-size: 12px;
            line-height: 17px;
            font-weight: bold;
            padding: 5px 10px;
            text-decoration: none;
            -moz-border-radius: 3px;
            -webkit-border-radius: 3px;
            border-radius: 3px;
            text-align: center;;
        }
        .info-table-data .info-table-result {
            border-top: 2px solid #c2d2e1;
            border-bottom: 2px solid #c2d2e1;
            padding: 30px 0;
        }
        .info-table-data .info-table-result table {
            width: 320px;
            border-spacing: 10px;
            border-collapse: collapse;
        }
        .info-table-data .result td {
            vertical-align: middle;
        }
        .info-table-data .result-field-name,
        .info-table-data .result-field-val {
            margin-bottom: 12px;
        }
        .info-table-data .result-field-name.last,
        .info-table-data .result-field-val.last {
            margin-bottom: 0;
        }
        .info-table-data .result-field-name {
            font-size: 18px;
            line-height: 22px;
            color: #333;
            font-weight: bold;
            margin-right: 30px;
        }
        .info-table-data .result-field-val {
            font-size: 24px;
            line-height: 28px;
            color: #333;
        }

        .info-request {
            background: #fff;
            color: #333;
        }
        .info-request .info-request-title {
            color: #333;
            font-size: 18px;
            line-height: 24px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .info-request .info-request-content {
            font-size: 13px;
            line-height: 20px;
            margin-bottom: 20px;
        }

        .info-small-mes {
            background: #fff;
            color: #333;
        }
        .info-small-mes .info-small-mes-title {
            color: #333;
            font-size: 15px;
            line-height: 20px;
            font-weight: bold;
            margin-bottom: 17px;
        }
        .info-small-mes .info-small-mes-content {
            font-size: 13px;
            line-height: 20px;
            margin-bottom: 20px;
        }

        .info-links .info-links-row {
            margin-bottom: 15px;
        }
        .info-links .info-links-row a {
            display: inline;
        }
        .info-links .info-links-row.last {
            margin-bottom: 0;
        }
        .info-links .info-links-item {
            display: inline;
            font-size: 13px;
            line-height: 25px;
            margin-right: 25px;
        }
        .info-links .info-links-item.last {
            margin-right: 0;
        }
        .info-links .info-links-separator {
            display: inline;
            margin-right: 25px;
            color: #999;
        }
        .info-links .info-links-title {
            display: inline;
            font-weight: bold;
            margin-right: 25px;
            font-size: 15px;
            line-height: 25px;
            color: #333;
        }
    </style>

    <!-- media -->
    <style type="text/css">
        @media only screen and (max-width:1000px) {
            .body-table {
                width: 100%!important;
            }
        }
    </style>

	</head>
	<body style="margin-top:0;margin-bottom:0;margin-right:0;margin-left:0;border-width:0;padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;font-family:Arial, sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:none;" >
	<div class="body-table-wrapper" style="text-align:center;" >
		<table class="body-table" style="border-spacing:0;border-collapse:collapse;width:1000px;text-align:left;font-family:Arial, sans-serif;" >
			<tbody style="font-family:Arial, sans-serif;" >
			<!-- header -->
			<tr class="header" style="font-family:Arial, sans-serif;background-color:#369;" >
				<td class="logo" style="margin-top:0;margin-bottom:0;margin-right:0;margin-left:0;border-width:0;padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;font-family:Arial, sans-serif;width:100%;height:62px;max-height:62px;text-align:center;" >
					<a href="#" target="_blank" style="color:#369;font-family:Arial, sans-serif;" ><img src="https://my.fesco.com/images/logo_email.png" width="166" style="font-family:Arial, sans-serif;display:inline;width:166px;height:62px;max-height:62px;" /></a>
				</td>
			</tr>
			<tr>
         <td>
`;

const footer = `
 </td>
      </tr>
<tr class="sub-header" style="font-family:Arial, sans-serif;text-align:center;background-color:#3671ad;width:320px;" >
    <td style="margin-top:0;margin-bottom:0;margin-right:0;margin-left:0;border-width:0;padding-top:0;padding-bottom:0;padding-right:0;padding-left:0;font-family:Arial, sans-serif;" >
        <img src="https://my.fesco.com/images/sub_header_bg.png" width="100%" style="display:block;font-family:Arial, sans-serif;width:100%;" />
    </td>
</tr>

</tbody>
</table>
</div>
</body>
</html>
`;

export const subjectTemplate = `Fesco: <%= subjectData %>`;

export const bodyTemplate = `
${header}

<div class="info-request-inner" style="margin-top:20px;margin-bottom:25px;margin-right:20px;margin-left:20px;background-color:#fff;">
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:18px;line-height:24px;font-weight:bold;margin-bottom:10px;">
  Уважаемый(ая) <%= userName || 'пользователь' %>.
  </div>
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:13px;line-height:24px;font-weight:bold;margin-bottom:20px;">
  В связи с обновлением личного кабинета просим Вас произвести смену пароля в течении 4-6 часов, либо он будет сброшен автоматически и при следующей авторизации в личном кабинете Вам необходимо будет задать новый пароль.
  </div>
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:13px;line-height:24px;font-weight:bold;margin-bottom:20px;">
  Пароль Вы можете сменить по ссылке: https://my.fesco.com/change-password. Для смены пароля потребуется указать текущий пароль.
  </div>
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:13px;line-height:24px;font-weight:bold;margin-bottom:20px;">
  Если Вы забыли пароль, то можете сменить его по ссылке: https://my.fesco.com/forgot
  </div>
  
   <hr>
   
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:18px;line-height:24px;font-weight:bold;margin-bottom:10px;">
  Dear <%= userName || 'user' %>.
  </div>
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:13px;line-height:24px;font-weight:bold;margin-bottom:20px;">
  In connection with the update of your personal account, we ask you to change the password within 4-6 hours, or it will be reset automatically and you will need to set a new password at the next authorization in your account.
  </div>
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:13px;line-height:24px;font-weight:bold;margin-bottom:20px;">
  Password you can change the link: https://my.fesco.com/change-password. To change the password you will need to enter the current password.
  </div>
  <div class="info-request-title" style="text-transfotm:uppercase;color:#333;font-size:13px;line-height:24px;font-weight:bold;margin-bottom:20px;">
  If you have forgotten your password, you can change it via the link: https://my.fesco.com/forgot
  </div>
  
  <div class="info-request-content" style="font-size:13px;line-height:20px;margin-bottom:10px;">
    <hr>
    <div style="margin-top:15px;">
      С уважением,<br>
      команда Личного Кабинета FESCO.<br>
      <a href="https://my.fesco.com/?locale=ru" target="_blank">https://my.fesco.com</a>
    </div>
  </div>
</div>
<br>
${footer}
`;
